import { setTimeout as delay } from "node:timers/promises";
import dotenv from "dotenv";
import mongoose from "mongoose";
import { Kafka, Partitioners, logLevel } from "kafkajs";
import connectToMongoDB from "./db/connectToMongoDB.js";
import Message from "./models/message.model.js";
import ModerationOutbox from "./models/moderationOutbox.model.js";
import { moderationDecision } from "./utils/moderation.js";
import { logError, logInfo } from "./utils/logger.js";

dotenv.config();
const topics = { events: "moderation.events", dlq: "moderation.dlq" };
const crashAfterDecision = process.env.NODE_ENV === "development" && process.argv.includes("--crash-after-decision");
const brokers = process.env.MODERATION_KAFKA_BROKERS?.split(",").map((broker) => broker.trim()).filter(Boolean);
if (process.env.NODE_ENV === "production" || process.env.MODERATION_ENABLED !== "true" || !brokers?.length) {
  throw new Error("Enable moderation and configure MODERATION_KAFKA_BROKERS before starting the worker");
}

const kafka = new Kafka({
  clientId: "frenschat-moderation",
  brokers,
  logLevel: logLevel.NOTHING,
  connectionTimeout: 2000,
  requestTimeout: 3000,
  retry: { retries: 2, initialRetryTime: 250, maxRetryTime: 1000 },
});
const producer = kafka.producer({ createPartitioner: Partitioners.DefaultPartitioner, allowAutoTopicCreation: false });
const consumer = kafka.consumer({
  groupId: "frenschat-moderation-v1", allowAutoTopicCreation: false,
  sessionTimeout: 8000, heartbeatInterval: 2000,
});
const admin = kafka.admin();
let stopping = false;

function parseEvent(value) {
  if (!value || value.length > 1024) return null;
  try {
    const event = JSON.parse(value.toString());
    if (event?.version === 1 && typeof event.eventId === "string" &&
        /^[a-f0-9-]{36}$/u.test(event.eventId) && typeof event.messageId === "string" &&
        /^[a-f0-9]{24}$/u.test(event.messageId)) return event;
  } catch {
    return null;
  }
  return null;
}

async function publishLoop() {
  while (!stopping) {
    try {
      const queued = await ModerationOutbox.findOne({ publishedAt: null }).sort({ createdAt: 1 }).lean();
      if (!queued) {
        await delay(250);
        continue;
      }
      await producer.send({
        topic: topics.events, acks: -1,
        messages: [{
          key: queued.messageId.toString(),
          value: JSON.stringify({ version: 1, eventId: queued._id, messageId: queued.messageId }),
        }],
      });
      await ModerationOutbox.updateOne({ _id: queued._id, publishedAt: null }, { $set: { publishedAt: new Date() } });
    } catch {
      logError("moderation_publish_retry");
      await delay(1000);
    }
  }
}

async function consume({ topic, partition, message }) {
  const event = parseEvent(message.value);
  const stored = event && await Message.findOne({
    _id: event.messageId, moderationEventId: event.eventId,
  }).select("message moderationStatus").lean();

  if (!stored) {
    await producer.send({
      topic: topics.dlq, acks: -1,
      messages: [{ value: JSON.stringify({ topic, partition, offset: message.offset, reason: "INVALID_EVENT" }) }],
    });
  } else if (stored.moderationStatus === "pending") {
    const result = await Message.updateOne({
      _id: event.messageId, moderationEventId: event.eventId, moderationStatus: "pending",
    }, { $set: { ...moderationDecision(stored.message), moderationDecidedAt: new Date() } },
    { writeConcern: { w: "majority" } });
    if (result.modifiedCount === 1) {
      logInfo("moderation_decision_recorded", { eventId: event.eventId, partition, offset: message.offset });
      if (crashAfterDecision) process.exit(86);
    }
  } else {
    logInfo("moderation_replay_skipped", { eventId: event.eventId, partition, offset: message.offset });
  }

  await consumer.commitOffsets([{ topic, partition, offset: String(BigInt(message.offset) + 1n) }]);
}

async function start() {
  await connectToMongoDB();
  await Message.init();
  await ModerationOutbox.init();
  await admin.connect();
  await admin.createTopics({
    topics: Object.values(topics).map((topic) => ({ topic, numPartitions: 1, replicationFactor: 1 })),
  });
  await admin.disconnect();
  await producer.connect();
  await consumer.connect();
  await consumer.subscribe({ topic: topics.events, fromBeginning: true });
  consumer.on(consumer.events.CRASH, ({ payload }) => {
    if (!payload.restart) {
      logError("moderation_consumer_stopped");
      process.exit(1);
    }
  });
  await consumer.run({ autoCommit: false, eachMessage: consume });
  logInfo("moderation_worker_started");
  await publishLoop();
}

async function stop() {
  if (stopping) return;
  stopping = true;
  const timeout = setTimeout(() => process.exit(1), 9000);
  try {
    await consumer.disconnect();
    await producer.disconnect();
    await mongoose.disconnect();
  } finally {
    clearTimeout(timeout);
  }
}

for (const signal of ["SIGTERM", "SIGINT"]) {
  process.once(signal, () => stop().catch(() => process.exit(1)));
}
start().catch(() => {
  logError("moderation_worker_start_failed");
  process.exit(1);
});
