import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { authenticate, requirePermission } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { created, success } from "../../utils/response.js";
import { getPagination, paginationMeta } from "../../utils/pagination.js";
import { validatePromotion } from "../../services/promotion.service.js";

const router = Router();
router.use(authenticate);

const promotionSchema = z.object({
  code: z.string().trim().min(3).max(30).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(3).max(150),
  description: z.string().max(1000).optional().nullable(),
  type: z.enum(["PERCENT", "FIXED_AMOUNT", "BUY_X_GET_Y", "PRODUCT", "CATEGORY", "MEMBER", "HAPPY_HOUR"]),
  value: z.coerce.number().int().positive(),
  startAt: z.coerce.date(),
  endAt: z.coerce.date(),
  minOrderValue: z.coerce.number().int().min(0).default(0),
  maxDiscount: z.coerce.number().int().positive().optional().nullable(),
  totalUsageLimit: z.coerce.number().int().positive().optional().nullable(),
  usagePerCustomer: z.coerce.number().int().positive().default(1),
  buyQuantity: z.coerce.number().int().positive().optional().nullable(),
  getQuantity: z.coerce.number().int().positive().optional().nullable(),
  startHour: z.coerce.number().int().min(0).max(23).optional().nullable(),
  endHour: z.coerce.number().int().min(1).max(24).optional().nullable(),
  memberOnly: z.boolean().default(false),
  isActive: z.boolean().default(true),
  productIds: z.array(z.string()).default([]),
  categoryIds: z.array(z.string()).default([]),
}).refine((data) => data.endAt > data.startAt, {
  message: "Ngày kết thúc phải sau ngày bắt đầu",
  path: ["endAt"],
});

router.get(
  "/",
  requirePermission("promotions.manage", "pos.use"),
  asyncHandler(async (request, response) => {
    const { page, size, skip } = getPagination(request.query);
    const search = String(request.query.search || "").trim();
    const where = {
      ...(request.query.active === "true" ? { isActive: true, startAt: { lte: new Date() }, endAt: { gte: new Date() } } : {}),
      ...(search ? { OR: [{ code: { contains: search } }, { name: { contains: search } }] } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.promotion.findMany({
        where,
        include: {
          products: { include: { product: { select: { id: true, code: true, name: true } } } },
          categories: { include: { category: { select: { id: true, code: true, name: true } } } },
          _count: { select: { usages: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: size,
      }),
      prisma.promotion.count({ where }),
    ]);
    return success(response, items, "Lấy khuyến mãi thành công", paginationMeta(page, size, total));
  }),
);

router.post(
  "/",
  requirePermission("promotions.manage"),
  validate(promotionSchema),
  asyncHandler(async (request, response) => {
    const { productIds, categoryIds, ...data } = request.body;
    const promotion = await prisma.promotion.create({
      data: {
        ...data,
        products: { create: productIds.map((productId) => ({ productId })) },
        categories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
      },
    });
    return created(response, promotion, "Tạo khuyến mãi thành công");
  }),
);

router.post(
  "/validate",
  requirePermission("pos.use"),
  validate(z.object({
    code: z.string().min(3),
    customerId: z.string().optional().nullable(),
    originalAmount: z.number().int().min(0),
    lines: z.array(z.object({
      productId: z.string(),
      categoryId: z.string(),
      lineTotal: z.number().int().min(0),
    })),
  })),
  asyncHandler(async (request, response) => {
    const result = await validatePromotion(prisma, request.body.code, request.body);
    return success(response, {
      promotion: {
        id: result.promotion.id,
        code: result.promotion.code,
        name: result.promotion.name,
      },
      discount: result.discount,
    }, "Mã khuyến mãi hợp lệ");
  }),
);

export default router;

