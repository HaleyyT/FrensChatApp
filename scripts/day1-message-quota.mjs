import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { setTimeout as delay } from "node:timers/promises";
import { io } from "socket.io-client";

const mode = process.argv[2];
assert.ok(["baseline", "redis", "moderation", "repeat", "outage", "recovery"].includes(mode), "Unknown quota test mode");
const benchmark = process.argv.includes("--benchmark");
// Use only the loopback ports published by the synthetic Compose stack.
const origins = ["http://127.0.0.1:5101", "http://127.0.0.1:5102"];
const attempts = 50;
const quota = 10;
const windowMs = 10000;
const runId = randomBytes(6).toString("hex");
const payload = "Synthetic FrensChat Day 1 test message.";

async function request(node, path, { cookie, body } = {}) {
  const started = performance.now();
  const response = await fetch(`${origins[node]}/api${path}`, {
    method: body === undefined ? "GET" : "POST",
    headers: {
      ...(cookie && { Cookie: cookie }),
      ...(body !== undefined && { "Content-Type": "application/json" }),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
    signal: AbortSignal.timeout(5000),
    redirect: "error",
  });
  const data = await response.json();
  return {
    status: response.status,
    data,
    cookie: response.headers.get("set-cookie")?.split(";")[0],
    retryAfter: Number(response.headers.get("retry-after")),
    ms: performance.now() - started,
  };
}

async function account(label) {
  const username = `day1_${label}_${runId}`;
  const password = randomBytes(24).toString("hex");
  const signup = await request(0, "/auth/signup", {
    body: { username, password, confirmPassword: password, fullName: username, gender: "female" },
  });
  assert.equal(signup.status, 201, "Synthetic signup failed");
  const login = await request(1, "/auth/login", { body: { username, password } });
  assert.equal(login.status, 200, "Synthetic login failed");
  assert.ok(login.cookie?.startsWith("jwt="));
  assert.equal(login.data._id, signup.data._id);
  return { id: signup.data._id, cookie: login.cookie };
}

function send(node, sender, recipient, fields = {}) {
  return request(node, `/message/send/${recipient.id}`, {
    cookie: sender?.cookie,
    body: { message: payload, ...fields },
  });
}

async function history(sender, recipient) {
  const result = await request(1, `/message/${sender.id}?limit=100`, { cookie: recipient.cookie });
  assert.equal(result.status, 200);
  return result.data.messages.filter(({ senderId }) => senderId === sender.id);
}

function latency(results) {
  const sorted = results.map(({ ms }) => ms).sort((a, b) => a - b);
  const percentile = (fraction) => Number(sorted[Math.ceil(sorted.length * fraction) - 1].toFixed(2));
  return { p50Ms: percentile(0.5), p95Ms: percentile(0.95), p99Ms: percentile(0.99) };
}

const sender = await account("burst");
const recipient = await account("recv");

if (mode === "repeat") {
  const secondRecipient = await account("recv2");
  const events = [];
  const socket = io(origins[1], {
    extraHeaders: { Cookie: secondRecipient.cookie },
    transports: ["websocket"],
    reconnection: false,
    timeout: 3000,
  });
  socket.on("newMessage", (message) => events.push(message._id));
  try {
    await new Promise((resolve, reject) => {
      socket.once("connect", resolve);
      socket.once("connect_error", reject);
    });
    const first = await send(0, sender, recipient, { message: "Synthetic repeat" });
    const second = await send(1, sender, secondRecipient, { message: " SYNTHETIC   REPEAT " });
    assert.equal(first.status, 201);
    assert.equal(second.status, 201);
    const blocked = await Promise.all(
      Array.from({ length: 8 }, (_, index) =>
        send(index % 2, sender, index % 2 ? secondRecipient : recipient, { message: "synthetic repeat" })
      )
    );
    for (const result of blocked) {
      assert.equal(result.status, 429);
      assert.equal(result.data.error.code, "MESSAGE_REPEAT_COOLDOWN");
      assert.ok(result.retryAfter >= 1 && result.retryAfter <= 10);
    }
    const legitimate = [];
    for (let index = 0; index < 5; index++) {
      const result = await send(index % 2, sender, secondRecipient, { message: `Distinct synthetic text ${index}` });
      assert.equal(result.status, 201);
      legitimate.push(result);
    }
    const expectedEvents = [second.data._id, legitimate[1].data._id, legitimate[3].data._id];
    for (let attempt = 0; events.length < expectedEvents.length && attempt < 40; attempt++) await delay(25);
    assert.deepEqual(events, expectedEvents);
    assert.equal((await history(sender, recipient)).length, 1);
    assert.equal((await history(sender, secondRecipient)).length, 6);
    await delay(windowMs + 100);
    assert.equal((await send(1, sender, secondRecipient, { message: "synthetic repeat" })).status, 201);
    console.log(JSON.stringify({ repeatBlocked: 8, repeatAttemptsAfterThreshold: 8, distinctAccepted: 5,
      distinctAttempts: 5, sameNodeSocketDeliveries: expectedEvents.length, cooldownRollover: true }));
  } finally {
    socket.disconnect();
  }
} else if (mode === "outage" || mode === "recovery") {
  if (mode === "recovery") assert.equal((await send(0, recipient, sender)).status, 201);
  const results = await Promise.all(origins.map((_, node) => send(node, sender, recipient)));
  const expectedStatus = mode === "outage" ? 503 : 201;
  const maxResponseMs = Math.round(Math.max(...results.map(({ ms }) => ms)));
  for (const result of results) {
    assert.equal(result.status, expectedStatus);
    if (mode === "outage") assert.equal(result.data.error.code, "MESSAGE_QUOTA_UNAVAILABLE");
  }
  if (mode === "outage") assert.ok(maxResponseMs < 2000, "Local outage responses should be bounded");
  const persisted = (await history(sender, recipient)).length;
  assert.equal(persisted, mode === "outage" ? 0 : origins.length);
  console.log(JSON.stringify({
    mode,
    statuses: results.map(({ status }) => status),
    maxResponseMs,
    historyStillReadable: true,
    persisted,
  }, null, 2));
} else {
  const asyncModeration = mode === "moderation";
  const acceptedStatus = asyncModeration ? 202 : 201;
  const normal = await account("normal");
  assert.equal((await send(0, recipient, sender)).status, acceptedStatus);
  assert.equal((await send(1, recipient, normal)).status, acceptedStatus);
  assert.equal((await send(0, null, recipient)).status, 401);
  assert.equal((await send(1, sender, recipient, { message: "" })).status, 400);

  const normalResults = [];
  const normalStarted = performance.now();
  // One request per 1100 ms stays below the configured rolling quota.
  for (let index = 0; index < 20; index += 1) {
    if (index > 0) await delay(1100);
    normalResults.push(await send(index % 2, normal, recipient));
    assert.equal(normalResults.at(-1).status, acceptedStatus);
  }
  const normalSeconds = (performance.now() - normalStarted) / 1000;

  const burstStarted = performance.now();
  const results = await Promise.all(
    Array.from({ length: attempts }, (_, index) =>
      send(index % 2, sender, recipient, { senderId: normal.id })
    )
  );
  const burstMs = Math.round(performance.now() - burstStarted);
  assert.ok(burstMs < windowMs, "Burst must complete inside one quota window");
  const accepted = results.filter(({ status }) => status === acceptedStatus);
  const denied = results.filter(({ status }) => status === 429);
  assert.equal(accepted.length, mode === "baseline" ? attempts : quota);
  assert.equal(denied.length, attempts - accepted.length);
  assert.ok(accepted.every(({ data }) =>
    asyncModeration ? data.moderationStatus === "pending" : data.senderId === sender.id));
  assert.ok(denied.every(({ data, retryAfter }) =>
    data.error?.code === "MESSAGE_QUOTA_EXCEEDED" && retryAfter >= 1 && retryAfter <= 10
  ));
  const httpFinished = performance.now();
  let persisted = await history(sender, recipient);
  if (asyncModeration) {
    while (persisted.length < accepted.length && performance.now() - httpFinished < 12000) {
      await delay(250);
      persisted = await history(sender, recipient);
    }
  }
  const postAckVisibilityMs = asyncModeration ? Math.round(performance.now() - httpFinished) : null;
  assert.deepEqual(new Set(persisted.map(({ _id }) => _id)), new Set(accepted.map(({ data }) => data._id)));
  if (benchmark) {
    assert.deepEqual(new Set((await history(normal, recipient)).map(({ _id }) => _id)),
      new Set(normalResults.map(({ data }) => data._id)));
  }

  let rolloverStatus = null;
  if (mode === "redis" && !benchmark) {
    const deniedAgain = await send(1, sender, recipient);
    assert.equal(deniedAgain.status, 429);
    assert.equal(deniedAgain.data.error.code, "MESSAGE_QUOTA_EXCEEDED");
    // Another authenticated user retains their own quota during the denial.
    assert.equal((await send(0, recipient, sender)).status, 201);
    await delay(windowMs + 100);
    rolloverStatus = (await send(0, sender, recipient)).status;
    assert.equal(rolloverStatus, 201);
  }

  console.log(JSON.stringify({
    mode,
    apiInstances: origins.length,
    payloadBytes: Buffer.byteLength(payload),
    normal: { successful: normalResults.length, spacingMs: 1100,
      successfulRequestsPerSecond: Number((normalResults.length / normalSeconds).toFixed(3)),
      ...latency(normalResults) },
    burst: {
      attempts,
      requestsPerInstance: attempts / 2,
      durationMs: burstMs,
      accepted: accepted.length,
      denied: denied.length,
      persisted: persisted.length,
      postAckVisibilityMs,
      sendsAboveProposedQuota: accepted.length - quota,
    },
    rolloverStatus,
  }, null, 2));
}
