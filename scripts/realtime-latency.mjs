import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { arch, cpus, platform, totalmem } from "node:os";
import { setTimeout as delay } from "node:timers/promises";
import { io } from "socket.io-client";

const origin = "http://127.0.0.1:5101";
const trialCount = 3;
const samplesPerTrial = 40;
const pacingMs = 1100;
const timeoutMs = 5000;
const runId = randomBytes(5).toString("hex");

async function request(path, { method = "GET", body, cookie, expectedStatus } = {}) {
  const response = await fetch(`${origin}/api${path}`, {
    method,
    redirect: "error",
    headers: {
      ...(cookie && { Cookie: cookie }),
      ...(body && { "Content-Type": "application/json" }),
    },
    body: body && JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const value = await response.json();
  assert.equal(response.status, expectedStatus, `${method} ${path}: ${value.error?.code || response.status}`);
  return { value, cookie: response.headers.get("set-cookie")?.split(";")[0], at: performance.now() };
}

async function account(label) {
  const username = `rt_${runId}_${label}`;
  const password = randomBytes(20).toString("hex");
  const result = await request("/auth/signup", {
    method: "POST", expectedStatus: 201,
    body: { username, fullName: username, password, confirmPassword: password, gender: "female" },
  });
  assert.ok(result.cookie?.startsWith("jwt="));
  return { id: result.value._id, cookie: result.cookie };
}

function event(socket, name, matches = () => true) {
  let listener;
  let timer;
  const promise = new Promise((resolve, reject) => {
    listener = (value) => {
      const at = performance.now();
      if (matches(value)) resolve({ value, at });
    };
    socket.on(name, listener);
    timer = setTimeout(() => reject(new Error(`Timed out waiting for ${name}`)), timeoutMs);
  });
  const cancel = () => {
    socket.off(name, listener);
    clearTimeout(timer);
  };
  return { promise: promise.finally(cancel), cancel };
}

async function connect(cookie, sockets) {
  const socket = io(origin, {
    autoConnect: false, forceNew: true, reconnection: false,
    transports: ["websocket"], extraHeaders: { Cookie: cookie }, timeout: timeoutMs,
  });
  sockets.push(socket);
  const ready = event(socket, "connect");
  socket.connect();
  await ready.promise;
  return socket;
}

async function sample({ sender, recipient, senderSocket, recipientSocket }, message) {
  const incoming = event(recipientSocket, "newMessage", (value) =>
    value.message === message && value.senderId === sender.id && value.receiverId === recipient.id);

  try {
    const started = performance.now();
    const sending = request(`/message/send/${recipient.id}`, {
      method: "POST", body: { message }, cookie: sender.cookie, expectedStatus: 201,
    });
    const reading = incoming.promise.then(async (delivery) => {
      const messageId = delivery.value._id;
      const receipt = event(senderSocket, "messagesRead", (value) =>
        value.readerId === recipient.id && value.messageIds?.includes(messageId));
      try {
        const readStarted = performance.now();
        const [read, returned] = await Promise.all([
          request(`/message/read/${sender.id}`, {
            method: "PATCH", cookie: recipient.cookie, expectedStatus: 200,
          }),
          receipt.promise,
        ]);
        assert.deepEqual(read.value.readMessageIds, [messageId]);
        assert.equal(returned.value.readAt, read.value.readAt);
        return { delivery, returned, readStarted };
      } finally {
        receipt.cancel();
      }
    });
    const [send, { delivery, returned, readStarted }] = await Promise.all([sending, reading]);
    assert.equal(send.value._id, delivery.value._id);
    return {
      sendAckMs: send.at - started,
      deliveryMs: delivery.at - started,
      readReceiptMs: returned.at - readStarted,
      sendToReceiptMs: returned.at - started,
    };
  } finally {
    incoming.cancel();
  }
}

function statistics(samples) {
  return Object.fromEntries(Object.keys(samples[0]).map((key) => {
    const sorted = samples.map((item) => item[key]).sort((a, b) => a - b);
    const p = (fraction) => sorted[Math.ceil(fraction * sorted.length) - 1];
    return [key, { p50: p(.5), p95: p(.95), p99: p(.99), max: sorted.at(-1), p95Under100: p(.95) < 100 }];
  }));
}

const trials = [];
for (let trial = 0; trial < trialCount; trial++) {
  const sockets = [];
  try {
    const sender = await account(`${trial}_s`);
    const recipient = await account(`${trial}_r`);
    const senderSocket = await connect(sender.cookie, sockets);
    const recipientSocket = await connect(recipient.cookie, sockets);
    const pair = { sender, recipient, senderSocket, recipientSocket };
    await sample(pair, `Warmup ${runId} ${trial}`);
    await delay(pacingMs);

    const samples = [];
    for (let index = 0; index < samplesPerTrial; index++) {
      if (index > 0) await delay(pacingMs);
      samples.push(await sample(pair, `Latency ${runId} ${trial} ${index}`));
    }
    const metrics = statistics(samples);
    trials.push({ trial: trial + 1, metrics, samples });
    console.error(`Trial ${trial + 1}: ${samples.length}/${samplesPerTrial} completed; p95 send ${metrics.sendAckMs.p95.toFixed(2)} ms, delivery ${metrics.deliveryMs.p95.toFixed(2)} ms, receipt ${metrics.readReceiptMs.p95.toFixed(2)} ms`);
  } finally {
    for (const socket of sockets) socket.disconnect();
  }
}
const samples = trials.flatMap((trial) => trial.samples);
console.log(JSON.stringify({
  host: { platform: platform(), arch: arch(), logicalCpus: cpus().length, memoryBytes: totalmem(), node: process.version },
  profile: { trialCount, samplesPerTrial, pacingMs, transport: "websocket", topology: "same API replica" },
  completed: samples.length,
  metrics: statistics(samples),
  trials,
}));
