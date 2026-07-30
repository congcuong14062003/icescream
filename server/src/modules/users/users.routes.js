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
  fullName: z.string().trim().min(2).max(100).optional(),
  phone: z.string().trim().max(20).optional().nullable(),
  roleId: z.string().min(1).optional(),
  branchId: z.string().optional().nullable(),
  status: z.enum(["ACTIVE", "LOCKED", "INACTIVE"]).optional(),
});

router.get(
  "/meta",
  asyncHandler(async (request, response) => {
    const [roles, branches] = await Promise.all([
      prisma.role.findMany({ orderBy: { name: "asc" } }),
      prisma.branch.findMany({ where: { isActive: true, deletedAt: null }, orderBy: { name: "asc" } }),
    ]);
    return success(response, { roles, branches });
  }),
);

router.get(
  "/",
  asyncHandler(async (request, response) => {
    const { page, size, skip } = getPagination(request.query);
    const search = String(request.query.search || "").trim();
    const where = {
      deletedAt: null,
      ...(request.query.status ? { status: request.query.status } : {}),
      ...(request.query.role ? { role: { code: request.query.role } } : {}),
      ...(request.query.branchId ? { branchId: request.query.branchId } : {}),
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
    const oldUser = await prisma.user.findUnique({ where: { id: request.params.id } });
    if (!oldUser || oldUser.deletedAt) throw new ApiError(404, "Không tìm thấy nhân viên");
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

export default router;

