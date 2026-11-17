import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import User from "../models/user.models.js";
import { getIO, isUserOnline } from "../socket/socket.js";
import { createHttpError } from "../utils/httpError.js";
import { queueMessageForModeration, visibleMessages } from "../utils/moderation.js";

function getConversationKey(firstUserId, secondUserId) {
  return [firstUserId.toString(), secondUserId.toString()].sort().join(":");
}

export const sendMessage = async (req, res, next) => {
  try {
    const { message } = req.body;
    const { id: receiverId } = req.params;
    const trimmedMessage = message;

    // MUST come from protectRoutes middleware
    const senderId = req.user?._id; 

    if (!senderId) {
      throw createHttpError(401, "UNAUTHORIZED", "Unauthorized access");
    }

    if (receiverId === senderId.toString()) {
      throw createHttpError(400, "SELF_MESSAGE_FORBIDDEN", "Cannot send messages to yourself");
    }

    const receiver = await User.findById(receiverId).select("_id");

    if (!receiver) {
      throw createHttpError(404, "RECEIVER_NOT_FOUND", "Receiver not found");
    }

    const quota = req.app.locals.messageQuota;
    if (quota) {
      let decision;
      try {
        decision = await quota.check(senderId.toString(), trimmedMessage);
      } catch {
        throw createHttpError(503, "MESSAGE_QUOTA_UNAVAILABLE", "Message quota temporarily unavailable");
      }

      if (decision.retryAfter > 0) {
        res.set("Retry-After", String(decision.retryAfter));
        if (decision.repeated) {
          throw createHttpError(429, "MESSAGE_REPEAT_COOLDOWN", "Repeated message cooldown active");
        }
        throw createHttpError(429, "MESSAGE_QUOTA_EXCEEDED", "Message send limit reached");
      }
    }

    if (req.app.locals.moderationEnabled) {
      const queued = await queueMessageForModeration({ senderId, receiverId, message: trimmedMessage });
      return res.status(202).json(queued);
    }

    const conversationKey = getConversationKey(senderId, receiverId);
    let conversation = await Conversation.findOne({ conversationKey });

    if (!conversation) {
      const legacyConversation = await Conversation.findOne({
        participants: { $all: [senderId, receiverId] },
      });

      if (legacyConversation) {
        legacyConversation.conversationKey = conversationKey;
        conversation = await legacyConversation.save();
      } else {
        conversation = await Conversation.create({
          conversationKey,
          participants: [senderId, receiverId],
        });
      }
    }

    // Create + save message
    const newMessage = await Message.create({
      senderId,
      receiverId,
      message: trimmedMessage,
      deliveredAt: isUserOnline(receiverId) ? new Date() : null,
    });

    // Link message into conversation (match your schema field name!)
    conversation.message.push(newMessage._id);
    await conversation.save();

    const realtimeMessage = newMessage.toObject();

    // Keep the HTTP endpoint as the source of truth, then notify the receiver in realtime.
    getIO().to(receiverId.toString()).emit("newMessage", realtimeMessage);

    return res.status(201).json(newMessage);
  } catch (error) {
    next(error);
  }
};

export const markMessagesAsRead = async (req, res, next) => {
  try {
    const { id: otherUserId } = req.params;
    const readerId = req.user?._id;

    if (!readerId) {
      throw createHttpError(401, "UNAUTHORIZED", "Unauthorized access");
    }

    const readAt = new Date();
    const unreadMessages = await Message.find({
      ...visibleMessages,
      senderId: otherUserId,
      receiverId: readerId,
      readAt: null,
    }).select("_id senderId");

    if (unreadMessages.length === 0) {
      return res.status(200).json({ readMessageIds: [], readAt });
    }

    const readMessageIds = unreadMessages.map((message) => message._id);

    await Message.updateMany(
      { _id: { $in: readMessageIds } },
      { $set: { readAt, deliveredAt: readAt } }
    );

    getIO().to(otherUserId.toString()).emit("messagesRead", {
      readerId: readerId.toString(),
      messageIds: readMessageIds.map((messageId) => messageId.toString()),
      readAt,
    });

    return res.status(200).json({ readMessageIds, readAt });
  } catch (error) {
    next(error);
  }
};

export const getMessages = async (req, res, next) => {
  try {
    const { id: userToChatId } = req.params;
    const { before, limit } = req.query;
    const senderId = req.user?._id;

    if (!senderId) {
      throw createHttpError(401, "UNAUTHORIZED", "Unauthorized access");
    }

    const messageQuery = {
      ...visibleMessages,
      $or: [
        { senderId, receiverId: userToChatId },
        { senderId: userToChatId, receiverId: senderId },
      ],
    };

    if (before) {
      messageQuery.createdAt = { $lt: new Date(before) };
    }

    const messages = await Message.find(messageQuery)
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = messages.length > limit;
    const pagedMessages = hasMore ? messages.slice(0, limit) : messages;
    const orderedMessages = pagedMessages.reverse();
    const nextCursor = hasMore ? pagedMessages[pagedMessages.length - 1].createdAt.toISOString() : null;

    return res.status(200).json({
      messages: orderedMessages,
      paging: {
        limit,
        hasMore,
        nextCursor,
      },
    });
  } catch (error) {
    next(error);
  }
};
