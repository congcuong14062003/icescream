import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { authenticate, requirePermission } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { ApiError } from "../../utils/api-error.js";
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
  value: z.coerce.number().int().min(0).default(0),
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
  productIds: z.array(z.string()).max(500).default([]),
  categoryIds: z.array(z.string()).max(100).default([]),
}).superRefine((data, context) => {
  if (data.endAt <= data.startAt) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Ngày kết thúc phải sau ngày bắt đầu",
      path: ["endAt"],
    });
  }
  if (data.type === "BUY_X_GET_Y" && (!data.buyQuantity || !data.getQuantity)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Khuyến mãi mua tặng cần có số lượng mua và số lượng tặng",
      path: ["buyQuantity"],
    });
  }
  if (data.type !== "BUY_X_GET_Y" && data.value <= 0) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Giá trị khuyến mãi phải lớn hơn 0",
      path: ["value"],
    });
  }
  if (data.type === "PRODUCT" && !data.productIds.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Vui lòng chọn ít nhất một sản phẩm áp dụng",
      path: ["productIds"],
    });
  }
  if (data.type === "CATEGORY" && !data.categoryIds.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Vui lòng chọn ít nhất một danh mục áp dụng",
      path: ["categoryIds"],
    });
  }
  if (
    data.type === "HAPPY_HOUR" &&
    (data.startHour === null ||
      data.startHour === undefined ||
      data.endHour === null ||
      data.endHour === undefined ||
      data.startHour >= data.endHour)
  ) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Khung giờ kết thúc phải sau giờ bắt đầu",
      path: ["endHour"],
    });
  }
  if (new Set(data.productIds).size !== data.productIds.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Danh sách sản phẩm áp dụng bị trùng",
      path: ["productIds"],
    });
  }
  if (new Set(data.categoryIds).size !== data.categoryIds.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Danh sách danh mục áp dụng bị trùng",
      path: ["categoryIds"],
    });
  }
});

const promotionInclude = {
  products: {
    include: { product: { select: { id: true, code: true, name: true } } },
  },
  categories: {
    include: { category: { select: { id: true, code: true, name: true } } },
  },
  _count: { select: { usages: true } },
};

function promotionRuntimeStatus(promotion, now = new Date()) {
  if (!promotion.isActive) return "INACTIVE";
  if (promotion.startAt > now) return "UPCOMING";
  if (promotion.endAt < now) return "EXPIRED";
  if (
    promotion.totalUsageLimit &&
    promotion._count.usages >= promotion.totalUsageLimit
  ) {
    return "EXHAUSTED";
  }
  return "ACTIVE";
}

function serializePromotion(promotion) {
  return {
    ...promotion,
    runtimeStatus: promotionRuntimeStatus(promotion),
    usageRemaining: promotion.totalUsageLimit
      ? Math.max(0, promotion.totalUsageLimit - promotion._count.usages)
      : null,
  };
}

router.get(
  "/",
  requirePermission("promotions.manage", "pos.use"),
  asyncHandler(async (request, response) => {
    const { page, size, skip } = getPagination(request.query);
    const search = String(request.query.search || "").trim();
    const now = new Date();
    const statusWhere = {
      ACTIVE: { isActive: true, startAt: { lte: now }, endAt: { gte: now } },
      INACTIVE: { isActive: false },
      UPCOMING: { isActive: true, startAt: { gt: now } },
      EXPIRED: { endAt: { lt: now } },
    }[request.query.status];
    const where = {
      ...(request.query.active === "true"
        ? { isActive: true, startAt: { lte: now }, endAt: { gte: now } }
        : {}),
      ...(statusWhere || {}),
      ...(request.query.type ? { type: request.query.type } : {}),
      ...(search ? { OR: [{ code: { contains: search } }, { name: { contains: search } }] } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.promotion.findMany({
        where,
        include: promotionInclude,
        orderBy: { createdAt: "desc" },
        skip,
        take: size,
      }),
      prisma.promotion.count({ where }),
    ]);
    return success(
      response,
      items.map(serializePromotion),
      "Lấy khuyến mãi thành công",
      paginationMeta(page, size, total),
    );
  }),
);

router.post(
  "/",
  requirePermission("promotions.manage"),
  validate(promotionSchema),
  asyncHandler(async (request, response) => {
    const { productIds, categoryIds, ...data } = request.body;
    const promotion = await prisma.$transaction(async (tx) => {
      const item = await tx.promotion.create({
        data: {
          ...data,
          products: { create: productIds.map((productId) => ({ productId })) },
          categories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
        },
        include: promotionInclude,
      });
      await tx.auditLog.create({
        data: {
          userId: request.user.id,
          action: "PROMOTION_CREATE",
          entityType: "Promotion",
          entityId: item.id,
          newData: {
            code: item.code,
            name: item.name,
            type: item.type,
            isActive: item.isActive,
          },
          ipAddress: request.ip,
          userAgent: request.get("user-agent"),
        },
      });
      return item;
    });
    return created(response, serializePromotion(promotion), "Tạo khuyến mãi thành công");
  }),
);

router.put(
  "/:id",
  requirePermission("promotions.manage"),
  validate(promotionSchema),
  asyncHandler(async (request, response) => {
    const existing = await prisma.promotion.findUnique({
      where: { id: request.params.id },
      include: promotionInclude,
    });
    if (!existing) throw new ApiError(404, "Không tìm thấy chương trình ưu đãi");
    const { productIds, categoryIds, ...data } = request.body;
    const promotion = await prisma.$transaction(async (tx) => {
      await Promise.all([
        tx.promotionProduct.deleteMany({ where: { promotionId: existing.id } }),
        tx.promotionCategory.deleteMany({ where: { promotionId: existing.id } }),
      ]);
      const item = await tx.promotion.update({
        where: { id: existing.id },
        data: {
          ...data,
          products: { create: productIds.map((productId) => ({ productId })) },
          categories: { create: categoryIds.map((categoryId) => ({ categoryId })) },
        },
        include: promotionInclude,
      });
      await tx.auditLog.create({
        data: {
          userId: request.user.id,
          action: "PROMOTION_UPDATE",
          entityType: "Promotion",
          entityId: item.id,
          oldData: {
            code: existing.code,
            name: existing.name,
            type: existing.type,
            isActive: existing.isActive,
          },
          newData: {
            code: item.code,
            name: item.name,
            type: item.type,
            isActive: item.isActive,
          },
          ipAddress: request.ip,
          userAgent: request.get("user-agent"),
        },
      });
      return item;
    });
    return success(
      response,
      serializePromotion(promotion),
      "Cập nhật ưu đãi thành công",
    );
  }),
);

router.patch(
  "/:id/status",
  requirePermission("promotions.manage"),
  validate(z.object({ isActive: z.boolean() })),
  asyncHandler(async (request, response) => {
    const existing = await prisma.promotion.findUnique({
      where: { id: request.params.id },
      include: promotionInclude,
    });
    if (!existing) throw new ApiError(404, "Không tìm thấy chương trình ưu đãi");
    const promotion = await prisma.$transaction(async (tx) => {
      const item = await tx.promotion.update({
        where: { id: existing.id },
        data: { isActive: request.body.isActive },
        include: promotionInclude,
      });
      await tx.auditLog.create({
        data: {
          userId: request.user.id,
          action: request.body.isActive
            ? "PROMOTION_ACTIVATE"
            : "PROMOTION_DEACTIVATE",
          entityType: "Promotion",
          entityId: item.id,
          oldData: { isActive: existing.isActive },
          newData: { isActive: item.isActive },
          ipAddress: request.ip,
          userAgent: request.get("user-agent"),
        },
      });
      return item;
    });
    return success(
      response,
      serializePromotion(promotion),
      request.body.isActive ? "Đã bật chương trình ưu đãi" : "Đã tắt chương trình ưu đãi",
    );
  }),
);

router.delete(
  "/:id",
  requirePermission("promotions.manage"),
  asyncHandler(async (request, response) => {
    const existing = await prisma.promotion.findUnique({
      where: { id: request.params.id },
      include: promotionInclude,
    });
    if (!existing) throw new ApiError(404, "Không tìm thấy chương trình ưu đãi");
    if (existing._count.usages > 0) {
      throw new ApiError(
        422,
        "Ưu đãi đã phát sinh đơn hàng nên không thể xóa. Hãy tắt chương trình để giữ lịch sử.",
      );
    }
    await prisma.$transaction(async (tx) => {
      await tx.promotion.delete({ where: { id: existing.id } });
      await tx.auditLog.create({
        data: {
          userId: request.user.id,
          action: "PROMOTION_DELETE",
          entityType: "Promotion",
          entityId: existing.id,
          oldData: {
            code: existing.code,
            name: existing.name,
            type: existing.type,
          },
          ipAddress: request.ip,
          userAgent: request.get("user-agent"),
        },
      });
    });
    return success(
      response,
      { id: existing.id },
      "Đã xóa chương trình chưa phát sinh giao dịch",
    );
  }),
);

router.post(
  "/validate",
  requirePermission("pos.use"),
  validate(z.object({
    code: z.string().min(3),
    branchId: z.string().optional().nullable(),
    customerId: z.string().optional().nullable(),
    originalAmount: z.number().int().min(0),
    lines: z.array(z.object({
      productId: z.string(),
      categoryId: z.string(),
      unitPrice: z.number().int().min(0),
      quantity: z.number().int().min(1),
      lineTotal: z.number().int().min(0),
    })),
  })),
  asyncHandler(async (request, response) => {
    const branchId =
      request.user.role.code === "ADMIN" && request.body.branchId
        ? request.body.branchId
        : request.user.branch?.id;
    const result = await validatePromotion(prisma, request.body.code, {
      ...request.body,
      branchId,
    });
    return success(response, {
      promotion: result.promotion
        ? {
            id: result.promotion.id,
            code: result.promotion.code,
            name: result.promotion.name,
            type: result.promotion.type,
          }
        : null,
      voucher: result.voucher
        ? {
            id: result.voucher.id,
            code: result.voucher.code,
            branchId: result.voucher.branchId,
            type: result.voucher.type,
            value: result.voucher.value,
            expiresAt: result.voucher.expiresAt,
            membershipLevel: result.voucher.membershipLevel,
            branch: result.voucher.branch,
          }
        : null,
      discount: result.discount,
      benefit: result.benefit,
    }, result.voucher ? "Voucher hợp lệ" : "Mã khuyến mãi hợp lệ");
  }),
);

export default router;
