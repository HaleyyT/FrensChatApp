import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import User from "../models/user.models.js";
import { getIO, isUserOnline } from "../socket/socket.js";
import mongoose from "mongoose";

const MAX_MESSAGE_LENGTH = 2000;

export const sendMessage = async (req, res) => {
  try {
    const { message } = req.body;
    const { id: receiverId } = req.params;
    const trimmedMessage = typeof message === "string" ? message.trim() : "";

    // MUST come from protectRoutes middleware
    const senderId = req.user?._id; 

    if (!senderId) {
      return res.status(401).json({ error: "Unauthorized access" });
    }
    if (!trimmedMessage || !receiverId) {
      return res.status(400).json({ error: "Missing required fields" });
    }

    if (!mongoose.Types.ObjectId.isValid(receiverId)) {
      return res.status(400).json({ error: "Invalid receiver id" });
    }

    if (receiverId === senderId.toString()) {
      return res.status(400).json({ error: "Cannot send messages to yourself" });
    }

    if (trimmedMessage.length > MAX_MESSAGE_LENGTH) {
      return res.status(400).json({ error: `Message must be ${MAX_MESSAGE_LENGTH} characters or fewer` });
    }

    const receiver = await User.findById(receiverId).select("_id");

    if (!receiver) {
      return res.status(404).json({ error: "Receiver not found" });
    }

    // Find existing conversation between the two users
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId] },
    });

    // Create if not exists
    if (!conversation) {
      conversation = await Conversation.create({
        participants: [senderId, receiverId],
      });
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
    console.log("Error in sendMessage controller", error.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const markMessagesAsRead = async (req, res) => {
  try {
    const { id: otherUserId } = req.params;
    const readerId = req.user?._id;

    if (!readerId) {
      return res.status(401).json({ error: "Unauthorized access" });
    }

    if (!mongoose.Types.ObjectId.isValid(otherUserId)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const readAt = new Date();
    const unreadMessages = await Message.find({
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
    console.log("Error in markMessagesAsRead controller", error.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};

export const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const senderId = req.user?._id;

    if (!senderId) {
      return res.status(401).json({ error: "Unauthorized access" });
    }

    if (!mongoose.Types.ObjectId.isValid(userToChatId)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    // Find the shared conversation first, then populate the stored message references in order.
    const conversation = await Conversation.findOne({
      participants: { $all: [senderId, userToChatId] },
    }).populate("message");

    if (!conversation) {
      return res.status(200).json([]);
    }

    return res.status(200).json(conversation.message);
  } catch (error) {
    console.log("Error in getMessages controller", error.message);
    return res.status(500).json({ error: "Internal server error" });
  }
};
