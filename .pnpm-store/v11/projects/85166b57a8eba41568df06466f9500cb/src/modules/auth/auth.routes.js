import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { authenticate } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validate.js";
import {
  hashToken,
  randomToken,
  refreshCookieOptions,
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
} from "../../services/token.service.js";
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
  token: z.string().min(32),
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
      where: { deletedAt: null, OR: [{ username: login }, { email: login }] },
    });
    let debugToken;
    if (user) {
      const token = randomToken();
      await prisma.user.update({
        where: { id: user.id },
        data: {
          passwordResetHash: hashToken(token),
          passwordResetExpires: new Date(Date.now() + 30 * 60 * 1000),
        },
      });
      if (env.NODE_ENV === "development") debugToken = token;
    }
    return success(
      response,
      debugToken ? { debugToken } : {},
      "Nếu tài khoản tồn tại, hướng dẫn đặt lại mật khẩu đã được tạo",
    );
  }),
);

router.post(
  "/reset-password",
  validate(resetSchema),
  asyncHandler(async (request, response) => {
    const user = await prisma.user.findFirst({
      where: {
        passwordResetHash: hashToken(request.body.token),
        passwordResetExpires: { gt: new Date() },
        status: "ACTIVE",
        deletedAt: null,
      },
    });
    if (!user) throw new ApiError(422, "Liên kết đặt lại mật khẩu không hợp lệ hoặc đã hết hạn");
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

