import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { authenticate, requirePermission } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { getPagination, paginationMeta } from "../../utils/pagination.js";
import { createBusinessCode } from "../../utils/code.js";
import { created, success } from "../../utils/response.js";
import { ApiError } from "../../utils/api-error.js";
import { writeAudit } from "../../utils/audit.js";

const router = Router();
router.use(authenticate);

const customerSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  phone: z.string().trim().regex(/^[0-9+ ]{9,15}$/),
  email: z.string().email().optional().nullable().or(z.literal("")),
  dateOfBirth: z.preprocess(
    (value) => (value === "" || value == null ? null : value),
    z.coerce.date().nullable(),
  ).optional(),
  address: z.string().trim().max(500).optional().nullable(),
});

router.get(
  "/",
  requirePermission("customers.view", "pos.use"),
  asyncHandler(async (request, response) => {
    const { page, size, skip } = getPagination(request.query);
    const search = String(request.query.search || "").trim();
    const where = {
      deletedAt: null,
      ...(search
        ? {
            OR: [
              { fullName: { contains: search } },
              { phone: { contains: search } },
              { code: { contains: search } },
              { email: { contains: search } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.customer.findMany({
        where,
        include: { membershipLevel: true },
        orderBy: { createdAt: "desc" },
        skip,
        take: size,
      }),
      prisma.customer.count({ where }),
    ]);
    return success(response, items, "Lấy danh sách khách hàng thành công", paginationMeta(page, size, total));
  }),
);

router.get(
  "/:id",
  requirePermission("customers.view", "pos.use"),
  asyncHandler(async (request, response) => {
    const customer = await prisma.customer.findFirst({
      where: { id: request.params.id, deletedAt: null },
      include: {
        membershipLevel: true,
        pointTransactions: { orderBy: { createdAt: "desc" }, take: 30 },
        orders: {
          select: { id: true, code: true, totalAmount: true, status: true, createdAt: true },
          orderBy: { createdAt: "desc" },
          take: 20,
        },
      },
    });
    if (!customer) throw new ApiError(404, "Không tìm thấy khách hàng");
    return success(response, customer);
  }),
);

router.post(
  "/",
  requirePermission("customers.manage", "pos.use"),
  validate(customerSchema),
  asyncHandler(async (request, response) => {
    const defaultLevel = await prisma.membershipLevel.findFirst({ orderBy: { minSpending: "asc" } });
    if (!defaultLevel) throw new ApiError(500, "Hệ thống chưa cấu hình hạng thành viên");
    const customer = await prisma.customer.create({
      data: {
        ...request.body,
        email: request.body.email || null,
        code: createBusinessCode("KH"),
        membershipLevelId: defaultLevel.id,
      },
      include: { membershipLevel: true },
    });
    await writeAudit(prisma, request, "CUSTOMER_CREATE", "Customer", customer.id, null, {
      code: customer.code,
      phone: customer.phone,
    });
    return created(response, customer, "Tạo khách hàng thành công");
  }),
);

router.put(
  "/:id",
  requirePermission("customers.manage"),
  validate(customerSchema),
  asyncHandler(async (request, response) => {
    const oldCustomer = await prisma.customer.findFirst({
      where: { id: request.params.id, deletedAt: null },
    });
    if (!oldCustomer) throw new ApiError(404, "Không tìm thấy khách hàng");
    const customer = await prisma.customer.update({
      where: { id: oldCustomer.id },
      data: { ...request.body, email: request.body.email || null },
      include: { membershipLevel: true },
    });
    await writeAudit(prisma, request, "CUSTOMER_UPDATE", "Customer", customer.id, oldCustomer, customer);
    return success(response, customer, "Cập nhật khách hàng thành công");
  }),
);

export default router;
