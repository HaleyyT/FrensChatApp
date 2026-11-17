import { randomUUID } from "node:crypto";
import mongoose from "mongoose";
import Message from "../models/message.model.js";
import ModerationOutbox from "../models/moderationOutbox.model.js";

// Legacy messages have no status and remain visible.
export const visibleMessages = { moderationStatus: { $in: [null, "visible"] } };

export async function queueMessageForModeration({ senderId, receiverId, message }) {
  const eventId = randomUUID();
  const messageId = new mongoose.Types.ObjectId();
  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      await Message.create([{
        _id: messageId, senderId, receiverId, message,
        moderationStatus: "pending", moderationEventId: eventId,
      }], { session });
      await ModerationOutbox.create([{ _id: eventId, messageId }], { session });
    }, { writeConcern: { w: "majority" } });
    return { _id: messageId, moderationStatus: "pending" };
  } finally {
    await session.endSession();
  }
}

export function moderationDecision(message) {
  return /https?:\/\//iu.test(message)
    ? { moderationStatus: "quarantined", moderationReason: "DEMO_LINK_REVIEW" }
    : { moderationStatus: "visible", moderationReason: "NO_RULE_MATCH" };
}
