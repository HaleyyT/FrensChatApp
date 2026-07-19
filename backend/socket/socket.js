import { Server } from "socket.io";
import jwt from "jsonwebtoken";
import User from "../models/user.models.js";
import { errorDetails, logInfo, logWarn } from "../utils/logger.js";

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

function broadcastOnlineUsers() {
  if (!io) {
    return;
  }

  io.emit("onlineUsers", Array.from(onlineUserCounts.keys()));
}

export function attachSocketServer(server, allowedOrigins) {
  if (io) {
    io.close();
    onlineUserCounts.clear();
  }

  io = new Server(server, {
    cors: {
      origin: allowedOrigins,
      credentials: true,
    },
  });

  io.use(async (socket, next) => {
    const rejectConnection = (reason, error) => {
      logWarn("socket_connection_rejected", {
        reason,
        origin: socket.handshake.headers.origin,
        ...(error ? errorDetails(error) : {}),
      });
      return next(new Error("Unauthorized socket connection"));
    };

    try {
      const token = decodeURIComponent(getCookieValue(socket.handshake.headers.cookie, "jwt"));

      if (!token) {
        return rejectConnection("missing_auth_cookie");
      }

      const decoded = jwt.verify(token, process.env.JWT_SECRET);

      if (!decoded?.userId) {
        return rejectConnection("missing_user_id");
      }

      const user = await User.findById(decoded.userId).select("_id");

      if (!user) {
        return rejectConnection("user_not_found");
      }

      socket.userId = user._id.toString();
      return next();
    } catch (error) {
      return rejectConnection("invalid_auth_cookie", error);
    }
  });

  io.on("connection", (socket) => {
    const userId = socket.userId;

    // Join a room named after the user id so controllers can emit directly to that person.
    socket.join(userId);

    const nextConnectionCount = (onlineUserCounts.get(userId) || 0) + 1;
    onlineUserCounts.set(userId, nextConnectionCount);
    logInfo("socket_connected", { userId, socketId: socket.id, connectionCount: nextConnectionCount });
    broadcastOnlineUsers();

    socket.on("error", (error) => {
      logWarn("socket_error", { userId, socketId: socket.id, ...errorDetails(error) });
    });

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

    socket.on("disconnect", (reason) => {
      const currentConnectionCount = onlineUserCounts.get(userId) || 0;

      if (currentConnectionCount <= 1) {
        onlineUserCounts.delete(userId);
      } else {
        onlineUserCounts.set(userId, currentConnectionCount - 1);
      }

      logInfo("socket_disconnected", {
        userId,
        socketId: socket.id,
        reason,
        connectionCount: onlineUserCounts.get(userId) || 0,
      });
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

export function isUserOnline(userId) {
  return onlineUserCounts.has(userId.toString());
}

export function resetSocketState() {
  if (io) {
    io.close();
    io = undefined;
  }

  onlineUserCounts.clear();
}
