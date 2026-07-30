import http from "node:http";
import { Server } from "socket.io";
import app from "./app.js";
import { env } from "./config/env.js";
import { prisma } from "./config/prisma.js";
import { registerSockets } from "./sockets/index.js";
import { setSocketServer } from "./services/socket.service.js";

const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: env.CLIENT_URL,
    credentials: true,
  },
});

registerSockets(io);
setSocketServer(io);

server.listen(env.PORT, () => {
  console.log(`IceCream POS API đang chạy tại http://localhost:${env.PORT}`);
  console.log("Cơ sở dữ liệu: MySQL");
});

async function shutdown(signal) {
  console.log(`\nNhận ${signal}, đang đóng dịch vụ...`);
  io.close();
  server.close(async () => {
    await prisma.$disconnect();
    process.exit(0);
  });
  setTimeout(() => process.exit(1), 10_000).unref();
}

process.on("SIGINT", () => shutdown("SIGINT"));
process.on("SIGTERM", () => shutdown("SIGTERM"));
