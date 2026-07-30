import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import { env } from "../config/env.js";

export function signAccessToken(userId) {
  return jwt.sign({ sub: userId, type: "access" }, env.ACCESS_TOKEN_SECRET, {
    expiresIn: env.ACCESS_TOKEN_EXPIRES_IN,
    jwtid: crypto.randomUUID(),
  });
}

export function signRefreshToken(userId) {
  return jwt.sign({ sub: userId, type: "refresh" }, env.REFRESH_TOKEN_SECRET, {
    expiresIn: `${env.REFRESH_TOKEN_EXPIRES_DAYS}d`,
    jwtid: crypto.randomUUID(),
  });
}

export function verifyAccessToken(token) {
  return jwt.verify(token, env.ACCESS_TOKEN_SECRET);
}

export function verifyRefreshToken(token) {
  return jwt.verify(token, env.REFRESH_TOKEN_SECRET);
}

export function hashToken(token) {
  return crypto.createHash("sha256").update(token).digest("hex");
}

export function randomToken() {
  return crypto.randomBytes(32).toString("hex");
}

export function refreshCookieOptions() {
  return {
    httpOnly: true,
    secure: env.COOKIE_SECURE,
    sameSite: "lax",
    maxAge: env.REFRESH_TOKEN_EXPIRES_DAYS * 86400000,
    path: "/api/auth",
  };
}
