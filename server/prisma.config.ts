import "dotenv/config";
import { defineConfig } from "prisma/config";

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
    seed: "node prisma/seed.js",
  },
  datasource: {
    url:
      process.env.DATABASE_URL ||
      "mysql://icecream_app:IceCreamApp2026@localhost:3306/icecream_pos",
  },
});
