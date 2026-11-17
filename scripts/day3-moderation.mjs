import assert from "node:assert/strict";
import { execFile } from "node:child_process";
import { randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { promisify } from "node:util";
import { io } from "socket.io-client";

const exec = promisify(execFile);
const base = "http://127.0.0.1:5101";
const runId = randomBytes(6).toString("hex");
const compose = (...args) => exec("docker", [
  "compose", "-p", "frenschat-day3", "-f", "compose.yaml", "-f", "compose.moderation.yaml",
  "--profile", "moderation", ...args,
], { timeout: 55000 });

async function request(path, { cookie, method = "GET", body } = {}) {
  const response = await fetch(`${base}/api${path}`, {
    method,
    headers: {
      ...(cookie && { Cookie: cookie }),
      ...(body && { "Content-Type": "application/json" }),
    },
    body: body && JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
    redirect: "error",
  });
  return {
    status: response.status,
    value: await response.json(),
    cookie: response.headers.get("set-cookie")?.split(";")[0],
  };
}

async function account(label) {
  const username = `day3_${label}_${runId}`;
  const password = randomBytes(24).toString("hex");
  const result = await request("/auth/signup", {
    method: "POST", body: { username, password, confirmPassword: password, fullName: username, gender: "female" },
  });
  assert.equal(result.status, 201);
  assert.ok(result.cookie?.startsWith("jwt="));
  return { id: result.value._id, cookie: result.cookie };
}

async function submit(sender, recipient, message) {
  const { status, value } = await request(`/message/send/${recipient.id}`, {
    method: "POST", cookie: sender.cookie, body: { message },
  });
  assert.equal(status, 202);
  assert.deepEqual(Object.keys(value).sort(), ["_id", "moderationStatus"]);
  assert.equal(value.moderationStatus, "pending");
  return value._id;
}

async function database(messageId) {
  const { stdout } = await compose("exec", "-T", "api-a", "node", "--input-type=module", "-e", `
    import mongoose from "mongoose";
    await mongoose.connect(process.env.MONGO_URI);
    const id = new mongoose.Types.ObjectId(process.argv[1]);
    const message = await mongoose.connection.collection("messages").findOne({ _id: id },
      { projection: { moderationStatus: 1, moderationEventId: 1, moderationDecidedAt: 1, readAt: 1 } });
    const outbox = await mongoose.connection.collection("moderationoutboxes").find({ messageId: id }).toArray();
    console.log(JSON.stringify({ message, outbox }));
    await mongoose.disconnect();
  `, messageId);
  return JSON.parse(stdout);
}

async function eventually(check, label) {
  const expires = Date.now() + 30000;
  do {
    const result = await check();
    if (result) return result;
    await delay(250);
  } while (Date.now() < expires);
  throw new Error(`Timed out waiting for ${label}`);
}

async function workerLogs() {
  return (await compose("logs", "--no-color", "worker")).stdout;
}

function logEntries(output, event) {
  return output.split("\n")
    .filter((line) => line.includes(`"event":"${event}"`))
    .map((line) => JSON.parse(line.slice(line.indexOf("{"))));
}

async function hidden(sender, recipient, messageId, expectedUnread) {
  const session = { cookie: recipient.cookie };
  const history = await request(`/message/${sender.id}`, session);
  assert.equal(history.status, 200);
  assert.ok(history.value.messages.every((message) => message._id !== messageId));
  const sidebar = await request("/user/", session);
  assert.equal(sidebar.status, 200);
  const row = sidebar.value.filterUsers.find((entry) => entry._id === sender.id);
  assert.equal(row.unreadCount, expectedUnread);
  assert.notEqual(row.lastMessage?._id, messageId);
  const read = await request(`/message/read/${sender.id}`, { ...session, method: "PATCH" });
  assert.equal(read.status, 200);
  assert.ok(!read.value.readMessageIds.includes(messageId));
  assert.equal((await database(messageId)).message.readAt, null);
}

const sender = await account("sender");
const recipient = await account("recv");
const socket = io(base, { transports: ["websocket"], reconnection: false, timeout: 3000,
  extraHeaders: { Cookie: recipient.cookie } });
const received = [];
socket.on("newMessage", (message) => received.push(message._id));

try {
  await new Promise((resolve, reject) => {
    socket.once("connect", resolve);
    socket.once("connect_error", reject);
  });
  await compose("up", "-d", "worker");
  await eventually(async () => (await workerLogs()).includes("moderation_worker_started"), "worker startup");
  await compose("stop", "kafka");
  const messageId = await submit(sender, recipient, "Synthetic queued message");
  await hidden(sender, recipient, messageId, 0);
  const pending = await database(messageId);
  assert.equal(pending.message.moderationStatus, "pending");
  assert.equal(pending.outbox.length, 1);
  assert.equal(pending.outbox[0].publishedAt, null);
  await compose("stop", "worker");
  await compose("up", "-d", "--wait", "kafka");

  const recoveryStarted = performance.now();
  let crashDecision;
  await assert.rejects(compose("run", "--rm", "--no-deps", "worker",
    "node", "backend/moderation-worker.js", "--crash-after-decision"),
  (error) => {
    [crashDecision] = logEntries(error.stdout, "moderation_decision_recorded");
    return error.code === 86 && Boolean(crashDecision);
  });
  const recoveryToCrashMs = Math.round(performance.now() - recoveryStarted);
  const { message: decided } = await database(messageId);
  assert.equal(decided.moderationStatus, "visible");
  assert.ok(decided.moderationDecidedAt);

  const replayStarted = performance.now();
  await compose("up", "-d", "worker");
  await eventually(async () => {
    const logs = await workerLogs();
    return logEntries(logs, "moderation_replay_skipped").some((entry) =>
      entry.eventId === decided.moderationEventId && entry.partition === crashDecision.partition &&
      entry.offset === crashDecision.offset);
  }, "replay after crash");
  const restartToReplayMs = Math.round(performance.now() - replayStarted);
  assert.deepEqual((await database(messageId)).message, decided);
  const history = await request(`/message/${sender.id}`, { cookie: recipient.cookie });
  assert.equal(history.value.messages.filter((message) => message._id === messageId).length, 1);

  const { stdout } = await compose("exec", "-T", "api-a", "node", "--input-type=module", "-e", `
    import { Kafka, Partitioners, logLevel } from "kafkajs";
    const producer = new Kafka({brokers:["kafka:9092"],logLevel:logLevel.NOTHING})
      .producer({createPartitioner:Partitioners.DefaultPartitioner});
    await producer.connect();
    const [record] = await producer.send({topic:"moderation.events",messages:[{value:"invalid demo event"}]});
    console.log(record.baseOffset);
    await producer.disconnect();
  `);
  const poisonOffset = stdout.trim();
  const flaggedId = await submit(sender, recipient, "Synthetic review link https://example.test");
  await eventually(async () => {
    const { message } = await database(flaggedId);
    return message.moderationStatus === "quarantined";
  }, "healthy event following malformed event");
  await hidden(sender, recipient, flaggedId, 1);
  const dlq = await compose("exec", "-T", "kafka", "/opt/kafka/bin/kafka-console-consumer.sh",
    "--bootstrap-server", "localhost:9092", "--topic", "moderation.dlq",
    "--from-beginning", "--timeout-ms", "3000").catch((error) => {
    if (error.stdout) return error;
    throw error;
  });
  const records = dlq.stdout.trim().split("\n").map((line) => JSON.parse(line));
  assert.ok(records.some(({ offset, reason }) => offset === poisonOffset && reason === "INVALID_EVENT"));
  assert.deepEqual(received, []);

  console.log(JSON.stringify({
    pendingOutboxWhileKafkaStopped: pending.outbox.length,
    pendingAndQuarantinedAbsentFromRecipientViews: true,
    recoveryToForcedCrashMs: recoveryToCrashMs,
    restartToReplayMs,
    duplicateDecisionsAfterReplay: 0,
    visibleCopies: 1,
    testedMalformedEventsInDlq: records.filter(({ offset }) => offset === poisonOffset).length,
    healthyEventsProcessedAfterPoison: 1,
    prematureSocketEvents: received.length,
  }, null, 2));
} finally {
  socket.disconnect();
}
