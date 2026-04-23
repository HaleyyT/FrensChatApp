import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";
import User from "../models/user.models.js";
import { getIO } from "../socket/socket.js";
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

export const getMessages = async (req, res) => {
  try {
    const { id: userToChatId } = req.params;
    const senderId = req.user?._id;

    if (!senderId) {
      return res.status(401).json({ error: "Unauthorized access" });
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
