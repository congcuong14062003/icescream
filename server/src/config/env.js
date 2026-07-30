import "dotenv/config";
import { z } from "zod";

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  PORT: z.coerce.number().int().positive().default(4000),
  CLIENT_URL: z.string().url().default("http://localhost:5173"),
  DATABASE_URL: z.string().default("file:./dev.db"),
  ACCESS_TOKEN_SECRET: z.string().min(32),
  REFRESH_TOKEN_SECRET: z.string().min(32),
  ACCESS_TOKEN_EXPIRES_IN: z.string().default("15m"),
  REFRESH_TOKEN_EXPIRES_DAYS: z.coerce.number().int().positive().default(30),
  COOKIE_SECURE: z
    .string()
    .default("false")
    .transform((value) => value === "true"),
  CLOUDINARY_CLOUD_NAME: z.string().optional().default(""),
  CLOUDINARY_API_KEY: z.string().optional().default(""),
  CLOUDINARY_API_SECRET: z.string().optional().default(""),
  MAX_FILE_SIZE_MB: z.coerce.number().positive().default(5),
});

const parsed = schema.safeParse(process.env);

if (!parsed.success) {
  console.error("Cấu hình môi trường không hợp lệ:", parsed.error.flatten().fieldErrors);
  throw new Error("Không thể khởi động do cấu hình môi trường không hợp lệ");
}

export const env = parsed.data;

