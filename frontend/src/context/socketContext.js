import { createContext } from "react";

const SocketContext = createContext({
  socket: null,
  onlineUserIds: [],
});

export default SocketContext;
