import jwt from "jsonwebtoken";
import { env } from "../config/env.js";
import { prisma } from "../config/prisma.js";
import { getManagedBranchIds } from "../services/branch-access.service.js";

export function registerSockets(io) {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth?.token;
      if (!token) return next(new Error("Unauthorized"));
      const payload = jwt.verify(token, env.ACCESS_TOKEN_SECRET);
      const user = await prisma.user.findFirst({
        where: { id: payload.sub, status: "ACTIVE", deletedAt: null },
        select: {
          id: true,
          role: { select: { code: true } },
          branch: { select: { id: true } },
        },
      });
      if (!user) return next(new Error("Unauthorized"));
      socket.user = user;
      return next();
    } catch {
      return next(new Error("Unauthorized"));
    }
  });

  io.on("connection", async (socket) => {
    const allowedBranchIds = await getManagedBranchIds(prisma, socket.user);
    if (allowedBranchIds === null) {
      socket.join("orders:admin");
    } else {
      allowedBranchIds.forEach((branchId) => socket.join(`branch:${branchId}`));
    }

    socket.on("join:branch", async (branchId) => {
      if (!branchId) return;
      const currentBranchIds = await getManagedBranchIds(prisma, socket.user);
      if (currentBranchIds === null || currentBranchIds.includes(branchId)) {
        socket.join(`branch:${branchId}`);
      }
    });
  });
}
