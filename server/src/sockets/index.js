import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function registerSockets(io) {
  io.use((socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Unauthorized"));
      socket.user = jwt.verify(token, env.ACCESS_TOKEN_SECRET);
      return next();
    } catch {
      return next(new Error("Unauthorized"));
    }
  });

  io.on("connection", (socket) => {
    socket.on("join:branch", (branchId) => {
      if (branchId) socket.join(`branch:${branchId}`);
    });
  });
}

