import User from "../models/user.models.js";
import Message from "../models/message.model.js";

export const getUsersForSidebar = async (req, res, next) => {
    try {
        const loggedInUserId = req.user._id;

        // Hide the logged-in account so the sidebar only shows people available to chat with.
        const users = await User.find({ _id: { $ne: loggedInUserId } }).select("-password").lean();
        const userIds = new Set(users.map((user) => user._id.toString()));
        const recentMessages = await Message.find({
            $or: [
                { senderId: loggedInUserId },
                { receiverId: loggedInUserId },
            ],
        })
            .sort({ createdAt: -1 })
            .select("senderId receiverId message createdAt readAt deliveredAt")
            .lean();

        const conversationMetaByUserId = new Map();

        for (const message of recentMessages) {
            const senderId = message.senderId.toString();
            const receiverId = message.receiverId.toString();
            const otherUserId = senderId === loggedInUserId.toString() ? receiverId : senderId;

            if (!userIds.has(otherUserId)) {
                continue;
            }

            const currentMeta = conversationMetaByUserId.get(otherUserId) || {
                unreadCount: 0,
                lastMessage: null,
                lastActivityAt: null,
            };

            if (!currentMeta.lastMessage) {
                currentMeta.lastMessage = message;
                currentMeta.lastActivityAt = message.createdAt;
            }

            if (receiverId === loggedInUserId.toString() && !message.readAt) {
                currentMeta.unreadCount += 1;
            }

            conversationMetaByUserId.set(otherUserId, currentMeta);
        }

        const filterUsers = users
            .map((user) => {
                const meta = conversationMetaByUserId.get(user._id.toString()) || {};

                return {
                    ...user,
                    lastMessage: meta.lastMessage || null,
                    lastActivityAt: meta.lastActivityAt || null,
                    unreadCount: meta.unreadCount || 0,
                };
            })
            .sort((firstUser, secondUser) => {
                if (firstUser.unreadCount !== secondUser.unreadCount) {
                    return secondUser.unreadCount - firstUser.unreadCount;
                }

                const firstActivity = firstUser.lastActivityAt ? new Date(firstUser.lastActivityAt).getTime() : 0;
                const secondActivity = secondUser.lastActivityAt ? new Date(secondUser.lastActivityAt).getTime() : 0;

                if (firstActivity !== secondActivity) {
                    return secondActivity - firstActivity;
                }

                return firstUser.fullName.localeCompare(secondUser.fullName);
            });

        res.status(200).json({ filterUsers });
    } catch (error) {
        next(error);
    }
};
