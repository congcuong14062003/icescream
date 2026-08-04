import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { authenticate } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validate.js";
import {
  hashToken,
  refreshCookieOptions,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../services/token.service.js";
import { sendMail } from "../../services/email.service.js";
import { ApiError } from "../../utils/api-error.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { success } from "../../utils/response.js";
import { normalizeUser, safeUserSelect } from "../../utils/serializers.js";
import { writeAudit } from "../../utils/audit.js";

const router = Router();

const loginSchema = z.object({
  login: z.string().trim().min(3).max(120),
  password: z.string().min(6).max(128),
});

const profileSchema = z.object({
  fullName: z.string().trim().min(2).max(100),
  phone: z.string().trim().max(20).optional().nullable(),
  avatarUrl: z.string().url().optional().nullable().or(z.literal("")),
});

const changePasswordSchema = z.object({
  currentPassword: z.string().min(6).max(128),
  newPassword: z
    .string()
    .min(8, "Mật khẩu mới phải có ít nhất 8 ký tự")
    .max(128)
    .regex(/[A-Z]/, "Cần ít nhất một chữ hoa")
    .regex(/[a-z]/, "Cần ít nhất một chữ thường")
    .regex(/[0-9]/, "Cần ít nhất một chữ số"),
});

const forgotSchema = z.object({
  login: z.string().trim().min(3).max(120),
});

const resetSchema = z.object({
  login: z.string().trim().min(3).max(120),
  otp: z.string().trim().length(6),
  newPassword: z
    .string()
    .min(8)
    .max(128)
    .regex(/[A-Z]/)
    .regex(/[a-z]/)
    .regex(/[0-9]/),
});

async function issueSession(user, request, response) {
  const accessToken = signAccessToken(user.id);
  const refreshToken = signRefreshToken(user.id);
  await prisma.refreshToken.create({
    data: {
      tokenHash: hashToken(refreshToken),
      userId: user.id,
      userAgent: request.get("user-agent"),
      ipAddress: request.ip,
      expiresAt: new Date(Date.now() + env.REFRESH_TOKEN_EXPIRES_DAYS * 86400000),
    },
  });
  response.cookie("refreshToken", refreshToken, refreshCookieOptions());
  return accessToken;
}

router.post(
  "/login",
  validate(loginSchema),
  asyncHandler(async (request, response) => {
    const login = request.body.login.toLowerCase();
    const userWithPassword = await prisma.user.findFirst({
      where: {
        deletedAt: null,
        OR: [{ username: login }, { email: login }],
      },
      include: { role: true },
    });

    if (!userWithPassword) {
      throw new ApiError(401, "Tên đăng nhập hoặc mật khẩu không đúng");
    }

    const passwordMatches = await bcrypt.compare(
      request.body.password,
      userWithPassword.passwordHash,
    );
    const allowed = passwordMatches && userWithPassword.status === "ACTIVE";

    await prisma.loginHistory.create({
      data: {
        userId: userWithPassword.id,
        ipAddress: request.ip,
        userAgent: request.get("user-agent"),
        success: allowed,
        reason: !passwordMatches
          ? "Sai mật khẩu"
          : userWithPassword.status !== "ACTIVE"
            ? "Tài khoản bị khóa"
            : null,
      },
    });

    if (!passwordMatches) {
      throw new ApiError(401, "Tên đăng nhập hoặc mật khẩu không đúng");
    }
    if (userWithPassword.status !== "ACTIVE") {
      throw new ApiError(403, "Tài khoản đã bị khóa hoặc ngừng hoạt động");
    }

    await prisma.user.update({
      where: { id: userWithPassword.id },
      data: { lastLoginAt: new Date() },
    });

    const user = await prisma.user.findUnique({
      where: { id: userWithPassword.id },
      select: safeUserSelect,
    });
    const accessToken = await issueSession(userWithPassword, request, response);

    return success(
      response,
      { accessToken, user: normalizeUser(user) },
      "Đăng nhập thành công",
    );
  }),
);

router.post(
  "/refresh",
  asyncHandler(async (request, response) => {
    const token = request.cookies.refreshToken;
    if (!token) throw new ApiError(401, "Không tìm thấy refresh token");

    let payload;
    try {
      payload = verifyRefreshToken(token);
    } catch {
      throw new ApiError(401, "Refresh token không hợp lệ hoặc đã hết hạn");
    }

    const stored = await prisma.refreshToken.findUnique({
      where: { tokenHash: hashToken(token) },
      include: { user: true },
    });
    if (
      !stored ||
      stored.revokedAt ||
      stored.expiresAt < new Date() ||
      stored.user.status !== "ACTIVE" ||
      stored.userId !== payload.sub
    ) {
      throw new ApiError(401, "Phiên đăng nhập không còn hiệu lực");
    }

    await prisma.refreshToken.update({
      where: { id: stored.id },
      data: { revokedAt: new Date() },
    });
    const accessToken = await issueSession(stored.user, request, response);
    return success(response, { accessToken }, "Làm mới phiên đăng nhập thành công");
  }),
);

router.post(
  "/logout",
  asyncHandler(async (request, response) => {
    const token = request.cookies.refreshToken;
    if (token) {
      await prisma.refreshToken.updateMany({
        where: { tokenHash: hashToken(token), revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    response.clearCookie("refreshToken", refreshCookieOptions());
    return success(response, {}, "Đăng xuất thành công");
  }),
);

router.get(
  "/me",
  authenticate,
  asyncHandler(async (request, response) => {
    const user = await prisma.user.findUnique({
      where: { id: request.user.id },
      select: safeUserSelect,
    });
    return success(response, normalizeUser(user));
  }),
);

router.put(
  "/profile",
  authenticate,
  validate(profileSchema),
  asyncHandler(async (request, response) => {
    const oldUser = await prisma.user.findUnique({ where: { id: request.user.id } });
    const user = await prisma.user.update({
      where: { id: request.user.id },
      data: {
        fullName: request.body.fullName,
        phone: request.body.phone || null,
        avatarUrl: request.body.avatarUrl || null,
      },
      select: safeUserSelect,
    });
    await writeAudit(prisma, request, "PROFILE_UPDATE", "User", user.id, {
      fullName: oldUser.fullName,
      phone: oldUser.phone,
    }, {
      fullName: request.body.fullName,
      phone: request.body.phone,
    });
    return success(response, normalizeUser(user), "Cập nhật hồ sơ thành công");
  }),
);

router.post(
  "/change-password",
  authenticate,
  validate(changePasswordSchema),
  asyncHandler(async (request, response) => {
    const user = await prisma.user.findUnique({ where: { id: request.user.id } });
    const matches = await bcrypt.compare(request.body.currentPassword, user.passwordHash);
    if (!matches) throw new ApiError(422, "Mật khẩu hiện tại không đúng");
    if (await bcrypt.compare(request.body.newPassword, user.passwordHash)) {
      throw new ApiError(422, "Mật khẩu mới phải khác mật khẩu hiện tại");
    }
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: await bcrypt.hash(request.body.newPassword, 12) },
      }),
      prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      prisma.auditLog.create({
        data: {
          userId: user.id,
          action: "PASSWORD_CHANGE",
          entityType: "User",
          entityId: user.id,
          ipAddress: request.ip,
          userAgent: request.get("user-agent"),
        },
      }),
    ]);
    response.clearCookie("refreshToken", refreshCookieOptions());
    return success(response, {}, "Đổi mật khẩu thành công, vui lòng đăng nhập lại");
  }),
);

router.post(
  "/forgot-password",
  validate(forgotSchema),
  asyncHandler(async (request, response) => {
    const login = request.body.login.toLowerCase();
    const user = await prisma.user.findFirst({
      where: { deletedAt: null, status: "ACTIVE", OR: [{ username: login }, { email: login }] },
    });
    let debugOtp;
    if (user) {
      const otp = String(Math.floor(100000 + Math.random() * 900000));
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetHash: hashToken(otp),
          passwordResetExpires: new Date(Date.now() + 10 * 60 * 1000),
        },
      });
      await sendMail({
        to: user.email,
        subject: "Mã OTP đặt lại mật khẩu - IceCream POS",
        text: `Mã OTP đặt lại mật khẩu của bạn là ${otp}. Mã có hiệu lực trong 10 phút. Mở trang nhập OTP: ${env.CLIENT_URL.replace(/\/$/, "")}/reset-password?login=${encodeURIComponent(user.email)}`,
        html: `<div style="font-family:Arial,sans-serif;max-width:560px;margin:auto;padding:28px;border:1px solid #dbe7e4;border-radius:18px"><h2 style="color:#0f766e;margin-top:0">IceCream POS</h2><p>Bạn vừa yêu cầu đặt lại mật khẩu.</p><div style="font-size:32px;font-weight:800;letter-spacing:8px;text-align:center;color:#0f766e;background:#ecfdf5;padding:18px;border-radius:12px">${otp}</div><p style="color:#64748b">Mã OTP có hiệu lực trong 10 phút và chỉ dùng được một lần.</p><a href="${env.CLIENT_URL.replace(/\/$/, "")}/reset-password?login=${encodeURIComponent(user.email)}" style="display:block;text-align:center;background:#14b8a6;color:#fff;text-decoration:none;font-weight:700;padding:13px 20px;border-radius:10px">Nhập mã OTP</a><p style="font-size:12px;color:#94a3b8;margin-bottom:0;margin-top:22px">Nếu bạn không yêu cầu thao tác này, hãy bỏ qua email.</p></div>`,
      });
      if (env.NODE_ENV === "development") debugOtp = otp;
    }
    return success(
      response,
      debugOtp ? { debugOtp } : {},
      "Nếu tài khoản tồn tại, mã OTP đã được gửi về email",
    );
  }),
);

router.post(
  "/reset-password",
  validate(resetSchema),
  asyncHandler(async (request, response) => {
    const login = request.body.login.toLowerCase();
    const user = await prisma.user.findFirst({
      where: {
        OR: [{ username: login }, { email: login }],
        passwordResetHash: hashToken(request.body.otp),
        passwordResetExpires: { gt: new Date() },
        status: "ACTIVE",
        deletedAt: null,
      },
    });
    if (!user) throw new ApiError(422, "Mã OTP không hợp lệ hoặc đã hết hạn");
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash: await bcrypt.hash(request.body.newPassword, 12),
          passwordResetHash: null,
          passwordResetExpires: null,
        },
      }),
      prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
    ]);
    return success(response, {}, "Đặt lại mật khẩu thành công");
  }),
);

export default router;
