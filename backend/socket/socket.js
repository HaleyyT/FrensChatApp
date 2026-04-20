import { Server } from "socket.io";

let io;
const onlineUserCounts = new Map();

function broadcastOnlineUsers() {
  if (!io) {
    return;
  }

  io.emit("onlineUsers", Array.from(onlineUserCounts.keys()));
}

export function attachSocketServer(server, clientUrl) {
  io = new Server(server, {
    cors: {
      origin: clientUrl,
      credentials: true,
    },
  });

  io.on("connection", (socket) => {
    const userId = socket.handshake.query.userId;

    // Ignore anonymous socket connections so presence only reflects authenticated app users.
    if (!userId || typeof userId !== "string") {
      socket.disconnect(true);
      return;
    }

    // Join a room named after the user id so controllers can emit directly to that person.
    socket.join(userId);

    const nextConnectionCount = (onlineUserCounts.get(userId) || 0) + 1;
    onlineUserCounts.set(userId, nextConnectionCount);
    broadcastOnlineUsers();

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
