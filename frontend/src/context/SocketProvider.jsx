import { useEffect, useState } from "react";
import PropTypes from "prop-types";
import { io } from "socket.io-client";
import { SOCKET_SERVER_URL } from "../lib/api";
import SocketContext from "./socketContext";

export function SocketProvider({ currentUser, children }) {
  const [socket, setSocket] = useState(null);
  const [onlineUserIds, setOnlineUserIds] = useState([]);

  useEffect(() => {
    if (!currentUser?._id) {
      setOnlineUserIds([]);
      setSocket((currentSocket) => {
        currentSocket?.disconnect();
        return null;
      });
      return;
    }

    // Keep one shared socket connection per signed-in user so realtime features do not create duplicates.
    const nextSocket = io(SOCKET_SERVER_URL, {
      withCredentials: true,
    });

    nextSocket.on("onlineUsers", (userIds) => {
      setOnlineUserIds(userIds);
    });

    setSocket(nextSocket);

    return () => {
      nextSocket.off("onlineUsers");
      nextSocket.disconnect();
      setOnlineUserIds([]);
      setSocket(null);
    };
  }, [currentUser]);

  return (
    <SocketContext.Provider value={{ socket, onlineUserIds }}>
      {children}
    </SocketContext.Provider>
  );
}

SocketProvider.propTypes = {
  currentUser: PropTypes.shape({
    _id: PropTypes.string,
  }),
  children: PropTypes.node.isRequired,
};
