import Conversation from "../models/conversation.model.js";
import Message from "../models/message.model.js";

export const sendMessage = async (req, res) => {
  try {
    const { message } = req.body;
    const { id: receiverId } = req.params;

    // MUST come from protectRoutes middleware
    const senderId = req.user?._id; 

    if (!senderId) {
      return res.status(401).json({ error: "Unauthorized access" });
    }
    if (!message || !receiverId) {
      return res.status(400).json({ error: "Missing required fields" });
    }
    console.log("[sendMessage] sender:", senderId, "receiver:", receiverId, "hasMessage:", !!message, "\n");


    // Find existing conversation between the two users
    let conversation = await Conversation.findOne({
      participants: { $all: [senderId, receiverId] },
    });
    console.log("[sendMessage] conversation found:", !!conversation, conversation?._id, "\n");

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
      message,
    });
    console.log("New Message Created:", newMessage);

    // Link message into conversation (match your schema field name!)
    conversation.message.push(newMessage._id);
    await conversation.save();

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
