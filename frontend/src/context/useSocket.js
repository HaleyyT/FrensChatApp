import { useContext } from "react";
import SocketContext from "./socketContext";

export default function useSocket() {
  return useContext(SocketContext);
}
