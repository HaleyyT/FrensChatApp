import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import User from "../models/user.models.js";

let io;
const onlineUserCounts = new Map();

function getCookieValue(cookieHeader, cookieName) {
  if (!cookieHeader || typeof cookieHeader !== "string") {
    return "";
  }

  return cookieHeader
    .split(";")
    .map((cookie) => cookie.trim())
    .find((cookie) => cookie.startsWith(`${cookieName}=`))
    ?.slice(cookieName.length + 1) || "";
}

function getSocketToken(socket) {
  const cookieToken = getCookieValue(socket.handshake.headers.cookie, "jwt");

  if (cookieToken) {
    return decodeURIComponent(cookieToken);
  }

  return typeof socket.handshake.auth?.token === "string" ? socket.handshake.auth.token : "";
}

function broadcastOnlineUsers() {
  if (!io) {
    return;
  }

  io.emit("onlineUsers", Array.from(onlineUserCounts.keys()));
}

export function attachSocketServer(server, allowedOrigins) {
  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    try {
      const token = getSocketToken(socket);

      if (!token) {
        return next(new Error("Unauthorized socket connection"));
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (!decoded?.userId) {
        return next(new Error("Unauthorized socket connection"));
      }

      const user = await User.findById(decoded.userId).select("_id");

      if (!user) {
        return next(new Error("Unauthorized socket connection"));
      }

      socket.userId = user._id.toString();
      return next();
    } catch {
      return next(new Error("Unauthorized socket connection"));
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.userId;

    // Join a room named after the user id so controllers can emit directly to that person.
    socket.join(userId);

    const nextConnectionCount = (onlineUserCounts.get(userId) || 0) + 1;
    onlineUserCounts.set(userId, nextConnectionCount);
    broadcastOnlineUsers();

    socket.on("typing", ({ receiverId } = {}) => {
      if (!receiverId) {
        return;
      }

      // Forward typing state only to the intended receiver, not the whole socket server.
      io.to(receiverId).emit("typing", { senderId: userId });
    });

    socket.on("stopTyping", ({ receiverId } = {}) => {
      if (!receiverId) {
        return;
      }

      io.to(receiverId).emit("stopTyping", { senderId: userId });
    });

    socket.on("disconnect", () => {
      const currentConnectionCount = onlineUserCounts.get(userId) || 0;

      if (currentConnectionCount <= 1) {
        onlineUserCounts.delete(userId);
      } else {
        onlineUserCounts.set(userId, currentConnectionCount - 1);
      }

      broadcastOnlineUsers();
    });
  });

  return io;
}

export function getIO() {
  if (!io) {
    throw new Error("Socket.IO server has not been attached yet");
  }

  return io;
}
