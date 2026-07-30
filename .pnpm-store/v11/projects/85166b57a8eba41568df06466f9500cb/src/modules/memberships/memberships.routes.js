import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { authenticate, requirePermission } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { ApiError } from "../../utils/api-error.js";
import { createBusinessCode } from "../../utils/code.js";
import { created, success } from "../../utils/response.js";
import { writeAudit } from "../../utils/audit.js";

const router = Router();
router.use(authenticate);

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
