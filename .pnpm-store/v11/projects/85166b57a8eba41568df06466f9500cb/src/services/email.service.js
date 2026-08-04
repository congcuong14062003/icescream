import nodemailer from "nodemailer";
import { env } from "../config/env.js";

function hasSmtpConfig() {
  return Boolean(env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS);
}

let transport;

function getTransport() {
  if (!hasSmtpConfig()) return null;
  if (!transport) {
    transport = nodemailer.createTransport({
      host: env.SMTP_HOST,
      port: env.SMTP_PORT,
      secure: env.SMTP_SECURE,
      auth: {
        user: env.SMTP_USER,
        pass: env.SMTP_PASS,
      },
    });
  }
  return transport;
}

export async function sendMail({ to, subject, text, html }) {
  const mailer = getTransport();
  if (!mailer) {
    if (env.NODE_ENV === "development") {
      console.log("[mail:mock]", { to, subject, text });
    }
    return { skipped: true };
  }
  return mailer.sendMail({
    from: env.SMTP_FROM,
    to,
    subject,
    text,
    html,
  });
}

