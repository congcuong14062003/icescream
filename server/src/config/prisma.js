import { PrismaClient } from "../generated/prisma/index.js";

const globalForPrisma = globalThis;

export const prisma =
  globalForPrisma.__iceCreamPrisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    transactionOptions: {
      maxWait: 10_000,
      timeout: 30_000,
    },
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.__iceCreamPrisma = prisma;
}

