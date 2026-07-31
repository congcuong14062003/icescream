import { Router } from "express";
import { randomBytes } from "node:crypto";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { authenticate, requirePermission } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { ApiError } from "../../utils/api-error.js";
import { createBusinessCode } from "../../utils/code.js";
import { created, success } from "../../utils/response.js";
import { writeAudit } from "../../utils/audit.js";
import {
  assertVoucherBranchAccess,
  getManagedBranchIds,
} from "../../services/branch-access.service.js";
import { publicVoucher } from "../../services/loyalty.service.js";
import { getPagination, paginationMeta } from "../../utils/pagination.js";

const router = Router();
router.use(authenticate);

const levelSchema = z
  .object({
    minPoints: z.coerce.number().int().min(0).max(100000000),
    pointRate: z.coerce.number().min(0).max(100),
    voucherEnabled: z.boolean(),
    voucherType: z.enum(["PERCENT", "FIXED_AMOUNT"]),
    voucherValue: z.coerce.number().int().min(0).max(100000000),
    voucherMaxDiscount: z.preprocess(
      (value) => (value === "" || value == null ? null : value),
      z.coerce.number().int().positive().max(100000000).nullable(),
    ),
    voucherMinOrderValue: z.coerce.number().int().min(0).max(100000000),
    voucherValidityDays: z.coerce.number().int().min(1).max(3650),
    voucherCooldownDays: z.coerce.number().int().min(0).max(3650),
    voucherRenewalOrderMinAmount: z.coerce
      .number()
      .int()
      .min(0)
      .max(100000000),
  })
  .superRefine((value, context) => {
    if (value.voucherEnabled && value.voucherValue <= 0) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["voucherValue"],
        message: "Giá trị voucher phải lớn hơn 0 khi bật cấp voucher",
      });
    }
    if (value.voucherType === "PERCENT" && value.voucherValue > 100) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["voucherValue"],
        message: "Voucher phần trăm không được vượt quá 100%",
      });
    }
  });

const manualVoucherSchema = z
  .object({
    customerId: z.string().min(1),
    branchIds: z.array(z.string().min(1)).min(1).max(50),
    type: z.enum(["PERCENT", "FIXED_AMOUNT"]),
    value: z.coerce.number().int().positive().max(100000000),
    maxDiscount: z.preprocess(
      (value) => (value === "" || value == null ? null : value),
      z.coerce.number().int().positive().max(100000000).nullable(),
    ),
    minOrderValue: z.coerce.number().int().min(0).max(100000000),
    validityDays: z.coerce.number().int().min(1).max(3650),
  })
  .superRefine((value, context) => {
    if (value.type === "PERCENT" && value.value > 100) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["value"],
        message: "Voucher phần trăm không được vượt quá 100%",
      });
    }
  });

const planSchema = z.object({
  code: z.string().trim().min(2).max(30).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2).max(120),
  description: z.string().trim().max(1000).optional().nullable(),
  price: z.coerce.number().int().min(0).max(100000000),
  durationDays: z.coerce.number().int().min(1).max(3650),
  dailyFreeQuantity: z.coerce.number().int().min(1).max(1).default(1),
  benefitVariantId: z.string().min(1),
  isActive: z.boolean().default(true),
});

const subscriptionSchema = z.object({
  customerId: z.string().min(1),
  membershipPlanId: z.string().min(1),
  branchId: z.string().optional().nullable(),
  paymentMethod: z.enum(["CASH", "BANK_TRANSFER", "CARD", "EWALLET"]),
  referenceCode: z.string().trim().max(100).optional().nullable(),
  note: z.string().trim().max(500).optional().nullable(),
});

const planInclude = {
  benefitVariant: {
    include: {
      product: {
        select: { id: true, code: true, name: true, imageUrl: true, status: true },
      },
    },
  },
  products: {
    include: {
      product: {
        select: { id: true, code: true, name: true, imageUrl: true, status: true },
      },
    },
  },
  _count: { select: { subscriptions: true } },
};

function serializePlan(plan) {
  return {
    ...plan,
    productIds: plan.products.map((item) => item.productId),
  };
}

function createVoucherCode(branchCode) {
  const branchPart = branchCode
    .replace(/[^A-Z0-9]/gi, "")
    .toUpperCase()
    .slice(-4);
  return `VC${branchPart}${Date.now().toString(36).toUpperCase()}${randomBytes(3).toString("hex").toUpperCase()}`;
}

const voucherInclude = {
  customer: {
    select: {
      id: true,
      code: true,
      fullName: true,
      phone: true,
    },
  },
  membershipLevel: {
    select: { id: true, code: true, name: true },
  },
  branch: {
    select: { id: true, code: true, name: true },
  },
  createdBy: {
    select: { id: true, fullName: true },
  },
  issuedFromOrder: {
    select: { id: true, code: true },
  },
  usedOrder: {
    select: { id: true, code: true },
  },
};

router.get(
  "/vouchers",
  requirePermission("promotions.manage"),
  asyncHandler(async (request, response) => {
    const { page, size, skip } = getPagination(request.query);
    const allowedBranchIds = await getManagedBranchIds(prisma, request.user);
    const requestedBranchId = request.query.branchId
      ? String(request.query.branchId)
      : null;
    const requestedStatus = request.query.status
      ? String(request.query.status)
      : null;
    if (
      requestedStatus &&
      !["ACTIVE", "USED", "EXPIRED", "CANCELLED"].includes(requestedStatus)
    ) {
      throw new ApiError(422, "Trạng thái voucher không hợp lệ");
    }
    if (
      requestedBranchId &&
      allowedBranchIds &&
      !allowedBranchIds.includes(requestedBranchId)
    ) {
      throw new ApiError(403, "Bạn không được xem voucher của chi nhánh này");
    }
    const search = String(request.query.search || "").trim();
    const now = new Date();
    const where = {
      ...(allowedBranchIds ? { branchId: { in: allowedBranchIds } } : {}),
      ...(requestedBranchId ? { branchId: requestedBranchId } : {}),
      ...(requestedStatus ? { status: requestedStatus } : {}),
      ...(request.query.customerId
        ? { customerId: String(request.query.customerId) }
        : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: search } },
              { customer: { fullName: { contains: search } } },
              { customer: { phone: { contains: search } } },
            ],
          }
        : {}),
    };
    await prisma.customerVoucher.updateMany({
      where: {
        ...(allowedBranchIds ? { branchId: { in: allowedBranchIds } } : {}),
        status: "ACTIVE",
        expiresAt: { lte: now },
      },
      data: { status: "EXPIRED" },
    });
    const [items, total] = await Promise.all([
      prisma.customerVoucher.findMany({
        where,
        include: voucherInclude,
        orderBy: { createdAt: "desc" },
        skip,
        take: size,
      }),
      prisma.customerVoucher.count({ where }),
    ]);
    return success(
      response,
      items.map((voucher) => publicVoucher(voucher, now)),
      "Lấy danh sách voucher thành công",
      paginationMeta(page, size, total),
    );
  }),
);

router.post(
  "/vouchers",
  requirePermission("promotions.manage"),
  validate(manualVoucherSchema),
  asyncHandler(async (request, response) => {
    const customer = await prisma.customer.findFirst({
      where: { id: request.body.customerId, deletedAt: null },
      include: { membershipLevel: true },
    });
    if (!customer) throw new ApiError(404, "Không tìm thấy khách hàng");
    const branches = await assertVoucherBranchAccess(
      prisma,
      request.user,
      request.body.branchIds,
    );
    const expiresAt = new Date(
      Date.now() + request.body.validityDays * 86400000,
    );
    const vouchers = await prisma.$transaction(async (tx) => {
      const createdVouchers = [];
      for (const branch of branches) {
        createdVouchers.push(
          await tx.customerVoucher.create({
            data: {
              code: createVoucherCode(branch.code),
              customerId: customer.id,
              membershipLevelId: customer.membershipLevelId,
              branchId: branch.id,
              createdById: request.user.id,
              type: request.body.type,
              value: request.body.value,
              maxDiscount: request.body.maxDiscount,
              minOrderValue: request.body.minOrderValue,
              issueReason: "MANUAL",
              expiresAt,
            },
            include: voucherInclude,
          }),
        );
      }
      await tx.auditLog.create({
        data: {
          userId: request.user.id,
          action: "CUSTOMER_VOUCHER_BATCH_CREATE",
          entityType: "CustomerVoucher",
          entityId: createdVouchers[0].id,
          newData: {
            voucherIds: createdVouchers.map((voucher) => voucher.id),
            customerId: customer.id,
            branchIds: branches.map((branch) => branch.id),
            voucherCodes: createdVouchers.map((voucher) => voucher.code),
            type: request.body.type,
            value: request.body.value,
            expiresAt,
          },
          ipAddress: request.ip,
          userAgent: request.get("user-agent"),
        },
      });
      return createdVouchers;
    });
    return created(
      response,
      vouchers.map((voucher) => publicVoucher(voucher)),
      `Đã phát hành ${vouchers.length} voucher theo chi nhánh`,
    );
  }),
);

router.patch(
  "/vouchers/:id/cancel",
  requirePermission("promotions.manage"),
  asyncHandler(async (request, response) => {
    const voucher = await prisma.customerVoucher.findUnique({
      where: { id: request.params.id },
      include: voucherInclude,
    });
    if (!voucher) throw new ApiError(404, "Không tìm thấy voucher");
    await assertVoucherBranchAccess(prisma, request.user, [voucher.branchId]);
    if (voucher.status !== "ACTIVE") {
      throw new ApiError(422, "Chỉ có thể hủy voucher đang hoạt động");
    }
    const updated = await prisma.customerVoucher.update({
      where: { id: voucher.id },
      data: { status: "CANCELLED" },
      include: voucherInclude,
    });
    await writeAudit(
      prisma,
      request,
      "CUSTOMER_VOUCHER_CANCEL",
      "CustomerVoucher",
      voucher.id,
      { status: voucher.status },
      { status: updated.status },
    );
    return success(response, publicVoucher(updated), "Đã hủy voucher");
  }),
);

router.get(
  "/levels",
  requirePermission("customers.view", "pos.use"),
  asyncHandler(async (request, response) => {
    const levels = await prisma.membershipLevel.findMany({
      include: {
        _count: { select: { customers: true, vouchers: true } },
      },
      orderBy: [{ displayOrder: "asc" }, { minPoints: "asc" }],
    });
    return success(response, levels, "Lấy cấu hình hạng khách hàng thành công");
  }),
);

router.put(
  "/levels/:id",
  requirePermission("promotions.manage"),
  validate(levelSchema),
  asyncHandler(async (request, response) => {
    const existing = await prisma.membershipLevel.findUnique({
      where: { id: request.params.id },
    });
    if (!existing) throw new ApiError(404, "Không tìm thấy hạng khách hàng");

    const levels = await prisma.membershipLevel.findMany({
      orderBy: { displayOrder: "asc" },
    });
    const index = levels.findIndex((item) => item.id === existing.id);
    const previous = levels[index - 1];
    const next = levels[index + 1];
    if (!previous && request.body.minPoints !== 0) {
      throw new ApiError(422, "Hạng đầu tiên phải bắt đầu từ 0 điểm");
    }
    if (previous && request.body.minPoints <= previous.minPoints) {
      throw new ApiError(
        422,
        `Mốc điểm phải lớn hơn hạng ${previous.name} (${previous.minPoints.toLocaleString("vi-VN")} điểm)`,
      );
    }
    if (next && request.body.minPoints >= next.minPoints) {
      throw new ApiError(
        422,
        `Mốc điểm phải nhỏ hơn hạng ${next.name} (${next.minPoints.toLocaleString("vi-VN")} điểm)`,
      );
    }

    const level = await prisma.membershipLevel.update({
      where: { id: existing.id },
      data: request.body,
      include: {
        _count: { select: { customers: true, vouchers: true } },
      },
    });
    await writeAudit(
      prisma,
      request,
      "MEMBERSHIP_LEVEL_CONFIG_UPDATE",
      "MembershipLevel",
      level.id,
      existing,
      level,
    );
    return success(response, level, "Cập nhật cấu hình hạng và voucher thành công");
  }),
);

async function getSellableBenefitVariant(tx, benefitVariantId) {
  const variant = await tx.productVariant.findFirst({
    where: {
      id: benefitVariantId,
      isActive: true,
      product: { deletedAt: null, status: "ACTIVE" },
    },
    include: {
      product: { select: { id: true, code: true, name: true } },
    },
  });
  if (!variant) {
    throw new ApiError(422, "Sản phẩm quà tặng không tồn tại hoặc đã ngừng bán");
  }
  return variant;
}

router.get(
  "/plans",
  requirePermission("customers.view", "pos.use"),
  asyncHandler(async (request, response) => {
    const activeOnly = String(request.query.active || "") === "true";
    const plans = await prisma.membershipPlan.findMany({
      where: activeOnly ? { isActive: true } : {},
      include: planInclude,
      orderBy: [{ isActive: "desc" }, { price: "asc" }],
    });
    return success(
      response,
      plans.map(serializePlan),
      "Lấy danh sách gói hội viên thành công",
    );
  }),
);

router.post(
  "/plans",
  requirePermission("promotions.manage"),
  validate(planSchema),
  asyncHandler(async (request, response) => {
    const benefitVariant = await getSellableBenefitVariant(
      prisma,
      request.body.benefitVariantId,
    );
    const plan = await prisma.membershipPlan.create({
      data: {
        ...request.body,
        description: request.body.description || null,
        products: {
          create: [{ productId: benefitVariant.productId }],
        },
      },
      include: planInclude,
    });
    await writeAudit(prisma, request, "MEMBERSHIP_PLAN_CREATE", "MembershipPlan", plan.id, null, {
      code: plan.code,
      name: plan.name,
      price: plan.price,
    });
    return created(response, serializePlan(plan), "Tạo gói hội viên thành công");
  }),
);

router.put(
  "/plans/:id",
  requirePermission("promotions.manage"),
  validate(planSchema),
  asyncHandler(async (request, response) => {
    const existing = await prisma.membershipPlan.findUnique({
      where: { id: request.params.id },
      include: planInclude,
    });
    if (!existing) throw new ApiError(404, "Không tìm thấy gói hội viên");
    const benefitVariant = await getSellableBenefitVariant(
      prisma,
      request.body.benefitVariantId,
    );
    const plan = await prisma.$transaction(async (tx) => {
      await tx.membershipPlanProduct.deleteMany({
        where: { membershipPlanId: existing.id },
      });
      return tx.membershipPlan.update({
        where: { id: existing.id },
        data: {
          ...request.body,
          description: request.body.description || null,
          products: {
            create: [{ productId: benefitVariant.productId }],
          },
        },
        include: planInclude,
      });
    });
    await writeAudit(prisma, request, "MEMBERSHIP_PLAN_UPDATE", "MembershipPlan", plan.id, {
      code: existing.code,
      name: existing.name,
      price: existing.price,
    }, {
      code: plan.code,
      name: plan.name,
      price: plan.price,
    });
    return success(response, serializePlan(plan), "Cập nhật gói hội viên thành công");
  }),
);

router.patch(
  "/plans/:id/status",
  requirePermission("promotions.manage"),
  validate(z.object({ isActive: z.boolean() })),
  asyncHandler(async (request, response) => {
    const existing = await prisma.membershipPlan.findUnique({
      where: { id: request.params.id },
    });
    if (!existing) throw new ApiError(404, "Không tìm thấy gói hội viên");
    const plan = await prisma.membershipPlan.update({
      where: { id: existing.id },
      data: { isActive: request.body.isActive },
      include: planInclude,
    });
    await writeAudit(prisma, request, "MEMBERSHIP_PLAN_STATUS", "MembershipPlan", plan.id, {
      isActive: existing.isActive,
    }, {
      isActive: plan.isActive,
    });
    return success(
      response,
      serializePlan(plan),
      plan.isActive ? "Đã mở bán gói hội viên" : "Đã ngừng bán gói hội viên",
    );
  }),
);

router.get(
  "/subscriptions",
  requirePermission("customers.view"),
  asyncHandler(async (request, response) => {
    const items = await prisma.membershipSubscription.findMany({
      where: {
        ...(request.query.customerId ? { customerId: String(request.query.customerId) } : {}),
      },
      include: {
        customer: { select: { id: true, code: true, fullName: true, phone: true } },
        membershipPlan: true,
        branch: { select: { id: true, code: true, name: true } },
        createdBy: { select: { id: true, fullName: true } },
        benefitUsages: {
          include: { order: { select: { id: true, code: true } } },
          orderBy: { createdAt: "desc" },
          take: 31,
        },
      },
      orderBy: { createdAt: "desc" },
      take: 200,
    });
    return success(response, items, "Lấy lịch sử đăng ký hội viên thành công");
  }),
);

router.post(
  "/subscriptions",
  requirePermission("customers.manage", "pos.use"),
  validate(subscriptionSchema),
  asyncHandler(async (request, response) => {
    const plan = await prisma.membershipPlan.findFirst({
      where: { id: request.body.membershipPlanId, isActive: true },
    });
    if (!plan) throw new ApiError(422, "Gói hội viên không tồn tại hoặc đã ngừng bán");
    const customer = await prisma.customer.findFirst({
      where: { id: request.body.customerId, deletedAt: null },
    });
    if (!customer) throw new ApiError(404, "Không tìm thấy khách hàng");

    const branchId =
      ["ADMIN", "MANAGER"].includes(request.user.role.code) && request.body.branchId
        ? request.body.branchId
        : request.user.branch?.id;
    if (!branchId) throw new ApiError(422, "Tài khoản chưa được gán chi nhánh");

    const branch = await prisma.branch.findFirst({
      where: { id: branchId, deletedAt: null, isActive: true },
      select: { id: true },
    });
    if (!branch) throw new ApiError(422, "Chi nhánh không tồn tại hoặc đã ngừng hoạt động");

    const shift = await prisma.workShift.findFirst({
      where: {
        userId: request.user.id,
        branchId,
        status: "OPEN",
      },
    });
    if (request.user.role.code === "CASHIER" && !shift) {
      throw new ApiError(422, "Thu ngân cần mở ca trước khi thu phí hội viên");
    }

    const latestMembership = await prisma.membershipSubscription.findFirst({
      where: {
        customerId: customer.id,
        status: "ACTIVE",
        endsAt: { gt: new Date() },
      },
      orderBy: { endsAt: "desc" },
    });
    const startsAt =
      latestMembership?.endsAt && latestMembership.endsAt > new Date()
        ? latestMembership.endsAt
        : new Date();
    const endsAt = new Date(startsAt.getTime() + plan.durationDays * 86400000);

    const subscription = await prisma.$transaction(async (tx) => {
      const item = await tx.membershipSubscription.create({
        data: {
          code: createBusinessCode("HV"),
          customerId: customer.id,
          membershipPlanId: plan.id,
          branchId,
          createdById: request.user.id,
          startsAt,
          endsAt,
          amountPaid: plan.price,
          paymentMethod: request.body.paymentMethod,
          referenceCode: request.body.referenceCode || null,
          note: request.body.note || null,
        },
        include: {
          membershipPlan: true,
          branch: { select: { id: true, code: true, name: true } },
          createdBy: { select: { id: true, fullName: true } },
        },
      });
      if (shift) {
        const field = {
          CASH: "cashRevenue",
          BANK_TRANSFER: "transferRevenue",
          CARD: "cardRevenue",
          EWALLET: "ewalletRevenue",
        }[request.body.paymentMethod];
        await tx.workShift.update({
          where: { id: shift.id },
          data: { [field]: { increment: plan.price } },
        });
      }
      await tx.auditLog.create({
        data: {
          userId: request.user.id,
          action: "MEMBERSHIP_SUBSCRIBE",
          entityType: "MembershipSubscription",
          entityId: item.id,
          newData: {
            code: item.code,
            customerId: customer.id,
            membershipPlanId: plan.id,
            amountPaid: plan.price,
            startsAt,
            endsAt,
          },
          ipAddress: request.ip,
          userAgent: request.get("user-agent"),
        },
      });
      return item;
    });

    return created(
      response,
      subscription,
      latestMembership
        ? "Gia hạn hội viên thành công; gói mới nối tiếp gói hiện tại"
        : "Đăng ký hội viên thành công",
    );
  }),
);

export default router;
