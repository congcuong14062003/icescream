import { io } from "socket.io-client";

let socket;

export function connectSocket(token, branchId) {
  if (socket) socket.disconnect();
  if (!token) return null;
  socket = io(import.meta.env.VITE_SOCKET_URL || "http://localhost:4000", {
    auth: { token },
  });
  socket.on("connect", () => {
    if (branchId) socket.emit("join:branch", branchId);
  });
  return socket;
}

export function disconnectSocket() {
  if (socket) socket.disconnect();
  socket = undefined;
}

export function getSocket() {
  return socket;
}
