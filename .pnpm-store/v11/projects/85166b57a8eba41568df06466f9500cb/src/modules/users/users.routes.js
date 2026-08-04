import { Router } from "express";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { authenticate, requirePermission } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validate.js";
import { ApiError } from "../../utils/api-error.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { getPagination, paginationMeta } from "../../utils/pagination.js";
import { created, success } from "../../utils/response.js";
import { normalizeUser, safeUserSelect } from "../../utils/serializers.js";
import { writeAudit } from "../../utils/audit.js";
import { getManagedBranchIds } from "../../services/branch-access.service.js";

const router = Router();
router.use(authenticate, requirePermission("users.manage"));

const createSchema = z.object({
  username: z.string().trim().min(3).max(40).transform((value) => value.toLowerCase()),
  email: z.string().email().transform((value) => value.toLowerCase()),
  fullName: z.string().trim().min(2).max(100),
  phone: z.string().trim().max(20).optional().nullable(),
  password: z.string().min(8).max(128),
  roleId: z.string().min(1),
  branchId: z.string().optional().nullable(),
});

const updateSchema = z.object({
  username: z.string().trim().min(3).max(40).transform((value) => value.toLowerCase()).optional(),
  email: z.string().email().transform((value) => value.toLowerCase()).optional(),
  fullName: z.string().trim().min(2).max(100).optional(),
  phone: z.string().trim().max(20).optional().nullable(),
  roleId: z.string().min(1).optional(),
  branchId: z.string().optional().nullable(),
  status: z.enum(["ACTIVE", "LOCKED", "INACTIVE"]).optional(),
});

const passwordResetSchema = z.object({
  newPassword: z
    .string()
    .min(8, "Mật khẩu mới phải có ít nhất 8 ký tự")
    .max(128)
    .regex(/[A-Z]/, "Cần ít nhất một chữ hoa")
    .regex(/[a-z]/, "Cần ít nhất một chữ thường")
    .regex(/[0-9]/, "Cần ít nhất một chữ số"),
});

function isAdmin(user) {
  return user.role.code === "ADMIN";
}

async function assertActiveBranch(branchId) {
  if (!branchId) return null;
  const branch = await prisma.branch.findFirst({
    where: { id: branchId, isActive: true, deletedAt: null },
    select: { id: true },
  });
  if (!branch) throw new ApiError(422, "Chi nhánh không tồn tại hoặc đã ngừng hoạt động");
  return branch;
}

async function assertAssignableRole(roleId, requestUser) {
  const role = await prisma.role.findUnique({
    where: { id: roleId },
    select: { id: true, code: true },
  });
  if (!role) throw new ApiError(422, "Vai trò không tồn tại");
  if (!isAdmin(requestUser) && role.code === "ADMIN") {
    throw new ApiError(403, "Quản lý cửa hàng không được cấp quyền Admin");
  }
  return role;
}

async function assertManagedBranch(requestUser, branchId) {
  const managedBranchIds = await getManagedBranchIds(prisma, requestUser);
  if (managedBranchIds && (!branchId || !managedBranchIds.includes(branchId))) {
    throw new ApiError(403, "Bạn chỉ được thao tác nhân viên thuộc chi nhánh mình quản lý");
  }
  return managedBranchIds;
}

router.get(
  "/meta",
  asyncHandler(async (request, response) => {
    const managedBranchIds = await getManagedBranchIds(prisma, request.user);
    const [roles, branches] = await Promise.all([
      prisma.role.findMany({
        where: isAdmin(request.user) ? {} : { code: { not: "ADMIN" } },
        orderBy: { name: "asc" },
      }),
      prisma.branch.findMany({
        where: {
          isActive: true,
          deletedAt: null,
          ...(managedBranchIds ? { id: { in: managedBranchIds } } : {}),
        },
        orderBy: { name: "asc" },
      }),
    ]);
    return success(response, {
      roles,
      branches,
      canUpdateBranch: isAdmin(request.user),
    });
  }),
);

router.get(
  "/",
  asyncHandler(async (request, response) => {
    const { page, size, skip } = getPagination(request.query);
    const search = String(request.query.search || "").trim();
    const managedBranchIds = await getManagedBranchIds(prisma, request.user);
    if (
      managedBranchIds &&
      request.query.branchId &&
      !managedBranchIds.includes(request.query.branchId)
    ) {
      throw new ApiError(403, "Bạn không được xem nhân viên của chi nhánh này");
    }
    if (managedBranchIds && request.query.role === "ADMIN") {
      throw new ApiError(403, "Quản lý cửa hàng không được xem tài khoản Admin");
    }
    const where = {
      deletedAt: null,
      ...(managedBranchIds
        ? {
            branchId: {
              in: request.query.branchId
                ? [request.query.branchId]
                : managedBranchIds,
            },
            role: { code: { not: "ADMIN" } },
          }
        : request.query.branchId
          ? { branchId: request.query.branchId }
          : {}),
      ...(request.query.status ? { status: request.query.status } : {}),
      ...(request.query.role ? { role: { code: request.query.role } } : {}),
      ...(search
        ? {
            OR: [
              { fullName: { contains: search } },
              { username: { contains: search } },
              { email: { contains: search } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.user.findMany({
        where,
        select: safeUserSelect,
        skip,
        take: size,
        orderBy: { createdAt: "desc" },
      }),
      prisma.user.count({ where }),
    ]);
    return success(
      response,
      items.map(normalizeUser),
      "Lấy danh sách nhân viên thành công",
      paginationMeta(page, size, total),
    );
  }),
);

router.post(
  "/",
  validate(createSchema),
  asyncHandler(async (request, response) => {
    await assertAssignableRole(request.body.roleId, request.user);
    await assertActiveBranch(request.body.branchId);
    if (!isAdmin(request.user)) {
      await assertManagedBranch(request.user, request.body.branchId);
    }
    const user = await prisma.user.create({
      data: {
        username: request.body.username,
        email: request.body.email,
        fullName: request.body.fullName,
        phone: request.body.phone || null,
        passwordHash: await bcrypt.hash(request.body.password, 12),
        roleId: request.body.roleId,
        branchId: request.body.branchId || null,
      },
      select: safeUserSelect,
    });
    await writeAudit(prisma, request, "USER_CREATE", "User", user.id, null, {
      username: user.username,
      role: user.role.code,
    });
    return created(response, normalizeUser(user), "Tạo tài khoản nhân viên thành công");
  }),
);

router.patch(
  "/:id",
  validate(updateSchema),
  asyncHandler(async (request, response) => {
    if (request.params.id === request.user.id && request.body.status && request.body.status !== "ACTIVE") {
      throw new ApiError(422, "Không thể tự khóa tài khoản đang đăng nhập");
    }
    const oldUser = await prisma.user.findUnique({
      where: { id: request.params.id },
      include: { role: { select: { code: true } } },
    });
    if (!oldUser || oldUser.deletedAt) throw new ApiError(404, "Không tìm thấy nhân viên");
    if (!isAdmin(request.user)) {
      await assertManagedBranch(request.user, oldUser.branchId);
      if (oldUser.role.code === "ADMIN") {
        throw new ApiError(403, "Quản lý cửa hàng không được chỉnh sửa tài khoản Admin");
      }
      if (
        Object.prototype.hasOwnProperty.call(request.body, "branchId") &&
        request.body.branchId !== oldUser.branchId
      ) {
        throw new ApiError(403, "Chỉ Admin mới được cập nhật chi nhánh cho nhân viên");
      }
    }
    if (request.body.roleId) {
      await assertAssignableRole(request.body.roleId, request.user);
    }
    if (Object.prototype.hasOwnProperty.call(request.body, "branchId")) {
      await assertActiveBranch(request.body.branchId);
    }
    const user = await prisma.user.update({
      where: { id: request.params.id },
      data: request.body,
      select: safeUserSelect,
    });
    if (request.body.status && request.body.status !== "ACTIVE") {
      await prisma.refreshToken.updateMany({
        where: { userId: user.id, revokedAt: null },
        data: { revokedAt: new Date() },
      });
    }
    await writeAudit(prisma, request, "USER_UPDATE", "User", user.id, {
      fullName: oldUser.fullName,
      status: oldUser.status,
      roleId: oldUser.roleId,
    }, request.body);
    return success(response, normalizeUser(user), "Cập nhật nhân viên thành công");
  }),
);

router.patch(
  "/:id/password",
  validate(passwordResetSchema),
  asyncHandler(async (request, response) => {
    const oldUser = await prisma.user.findUnique({
      where: { id: request.params.id },
      include: { role: { select: { code: true } } },
    });
    if (!oldUser || oldUser.deletedAt) throw new ApiError(404, "Không tìm thấy nhân viên");
    if (!isAdmin(request.user)) {
      await assertManagedBranch(request.user, oldUser.branchId);
      if (oldUser.role.code === "ADMIN") {
        throw new ApiError(403, "Quản lý cửa hàng không được đặt lại mật khẩu tài khoản Admin");
      }
    }

    await prisma.$transaction([
      prisma.user.update({
        where: { id: oldUser.id },
        data: { passwordHash: await bcrypt.hash(request.body.newPassword, 12) },
      }),
      prisma.refreshToken.updateMany({
        where: { userId: oldUser.id, revokedAt: null },
        data: { revokedAt: new Date() },
      }),
      prisma.auditLog.create({
        data: {
          userId: request.user.id,
          action: "USER_PASSWORD_RESET",
          entityType: "User",
          entityId: oldUser.id,
          oldData: { username: oldUser.username, role: oldUser.role.code },
          newData: { resetBy: request.user.id },
          ipAddress: request.ip,
          userAgent: request.get("user-agent"),
        },
      }),
    ]);

    return success(response, {}, "Đặt lại mật khẩu nhân viên thành công");
  }),
);

export default router;
