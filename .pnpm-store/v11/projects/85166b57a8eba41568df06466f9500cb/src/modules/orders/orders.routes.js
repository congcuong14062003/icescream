import { Router } from "express";
import PDFDocument from "pdfkit";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { authenticate, requirePermission } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validate.js";
import { calculateOrder } from "../../services/order-pricing.service.js";
import { deductInventory } from "../../services/inventory.service.js";
import {
  consumeCustomerVoucher,
  updateCustomerAfterCompletion,
} from "../../services/loyalty.service.js";
import { renderInvoicePdf } from "../../services/invoice-pdf.service.js";
import { emitOrderEvent } from "../../services/socket.service.js";
import { ApiError } from "../../utils/api-error.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { createBusinessCode } from "../../utils/code.js";
import { getPagination, paginationMeta } from "../../utils/pagination.js";
import { created, success } from "../../utils/response.js";
import { benefitDateFor, publicMembership } from "../../services/membership.service.js";

const router = Router();
router.use(authenticate);

const lineSchema = z.object({
  variantId: z.string().min(1),
  quantity: z.coerce.number().int().min(1).max(99),
  flavorIds: z.array(z.string()).default([]),
  toppingIds: z.array(z.string()).default([]),
  note: z.string().trim().max(300).optional().nullable(),
});

const quoteSchema = z.object({
  items: z.array(lineSchema).min(1),
  branchId: z.string().optional().nullable(),
  customerId: z.string().optional().nullable(),
  promotionCode: z.string().trim().max(30).optional().nullable(),
  pointsToRedeem: z.coerce.number().int().min(0).default(0),
  deliveryFee: z.coerce.number().int().min(0).max(1000000).default(0),
});

const createSchema = quoteSchema.extend({
  draftId: z.string().optional().nullable(),
  note: z.string().trim().max(1000).optional().nullable(),
  saveAsDraft: z.boolean().default(false),
  customerPaid: z.coerce.number().int().min(0).default(0),
  payments: z
    .array(
      z.object({
        method: z.enum(["CASH", "BANK_TRANSFER", "CARD", "EWALLET"]),
        amount: z.coerce.number().int().positive(),
        referenceCode: z.string().trim().max(100).optional().nullable(),
      }),
    )
    .default([]),
});

const orderInclude = {
  branch: { select: { id: true, code: true, name: true, address: true, phone: true } },
  customer: { include: { membershipLevel: true } },
  createdBy: { select: { id: true, fullName: true, username: true } },
  assignedTo: { select: { id: true, fullName: true } },
  promotion: { select: { id: true, code: true, name: true } },
  usedVoucher: {
    include: {
      membershipLevel: { select: { id: true, code: true, name: true } },
      branch: { select: { id: true, code: true, name: true } },
      createdBy: { select: { id: true, fullName: true } },
    },
  },
  issuedVouchers: {
    include: {
      membershipLevel: { select: { id: true, code: true, name: true } },
      branch: { select: { id: true, code: true, name: true } },
      createdBy: { select: { id: true, fullName: true } },
    },
  },
  items: {
    include: {
      product: { select: { id: true, code: true, name: true, imageUrl: true } },
      variant: true,
      flavors: { include: { flavor: true } },
      toppings: { include: { topping: true } },
    },
  },
  payments: true,
  refunds: true,
  statusHistory: {
    include: { changedBy: { select: { id: true, fullName: true } } },
    orderBy: { createdAt: "asc" },
  },
};

function orderDataFromPricing(request, pricing, branchId, shiftId, code, status) {
  return {
    code,
    branchId,
    customerId: request.body.customerId || null,
    createdById: request.user.id,
    shiftId,
    promotionId: pricing.promotion?.id || null,
    originalAmount: pricing.originalAmount,
    discountAmount: pricing.discountAmount,
    voucherDiscount: pricing.voucherDiscount,
    pointsDiscount: pricing.pointsDiscount,
    membershipDiscount: pricing.membershipDiscount,
    vatRate: pricing.vatRate,
    taxAmount: pricing.taxAmount,
    deliveryFee: pricing.deliveryFee,
    totalAmount: pricing.totalAmount,
    customerPaid: status === "DRAFT" ? 0 : request.body.customerPaid,
    changeAmount:
      status === "DRAFT" ? 0 : Math.max(0, request.body.customerPaid - pricing.totalAmount),
    paymentStatus: status === "DRAFT" ? "UNPAID" : "PAID",
    status,
    note: request.body.note || null,
    completedAt: status === "COMPLETED" ? new Date() : null,
  };
}

function resolveOrderBranchId(request) {
  if (request.user.role.code === "ADMIN" && request.body.branchId) {
    return request.body.branchId;
  }
  return request.user.branch?.id;
}

router.post(
  "/quote",
  requirePermission("pos.use"),
  validate(quoteSchema),
  asyncHandler(async (request, response) => {
    const branchId = resolveOrderBranchId(request);
    if (!branchId) {
      throw new ApiError(422, "Tài khoản chưa được gán chi nhánh");
    }
    const pricing = await calculateOrder(prisma, {
      ...request.body,
      branchId,
    });
    return success(response, {
      ...pricing,
      customer: pricing.customer
        ? {
            id: pricing.customer.id,
            fullName: pricing.customer.fullName,
            phone: pricing.customer.phone,
            points: pricing.customer.points,
            membershipLevel: pricing.customer.membershipLevel,
            activeMembership: publicMembership(pricing.activeMembership),
          }
        : null,
      promotion: pricing.promotion
        ? {
            id: pricing.promotion.id,
            code: pricing.promotion.code,
            name: pricing.promotion.name,
            type: pricing.promotion.type,
            buyQuantity: pricing.promotion.buyQuantity,
            getQuantity: pricing.promotion.getQuantity,
            benefit: pricing.promotionBenefit,
          }
        : null,
      voucher: pricing.voucher
        ? {
            id: pricing.voucher.id,
            code: pricing.voucher.code,
            branchId: pricing.voucher.branchId,
            type: pricing.voucher.type,
            value: pricing.voucher.value,
            expiresAt: pricing.voucher.expiresAt,
            membershipLevel: pricing.voucher.membershipLevel,
            branch: pricing.voucher.branch,
          }
        : null,
      activeMembership: publicMembership(pricing.activeMembership),
      membershipBenefit: pricing.membershipBenefit,
    }, "Tính giá đơn hàng thành công");
  }),
);

router.get(
  "/",
  requirePermission("orders.view"),
  asyncHandler(async (request, response) => {
    const { page, size, skip } = getPagination(request.query);
    const search = String(request.query.search || "").trim();
    const dateFrom = request.query.dateFrom ? new Date(`${request.query.dateFrom}T00:00:00`) : null;
    const dateTo = request.query.dateTo ? new Date(`${request.query.dateTo}T23:59:59.999`) : null;
    const where = {
      ...(request.query.branchId ? { branchId: request.query.branchId } : {}),
      ...(request.query.status ? { status: request.query.status } : {}),
      ...(request.query.paymentStatus ? { paymentStatus: request.query.paymentStatus } : {}),
      ...(request.query.employeeId ? { createdById: request.query.employeeId } : {}),
      ...(request.query.paymentMethod ? { payments: { some: { method: request.query.paymentMethod } } } : {}),
      ...(dateFrom || dateTo
        ? { createdAt: { ...(dateFrom ? { gte: dateFrom } : {}), ...(dateTo ? { lte: dateTo } : {}) } }
        : {}),
      ...(search
        ? {
            OR: [
              { code: { contains: search } },
              { customer: { phone: { contains: search } } },
              { customer: { fullName: { contains: search } } },
            ],
          }
        : {}),
    };
    if (!["ADMIN", "MANAGER"].includes(request.user.role.code) && request.user.branch?.id) {
      where.branchId = request.user.branch.id;
    }
    const [items, total] = await Promise.all([
      prisma.order.findMany({
        where,
        include: {
          branch: { select: { id: true, code: true, name: true } },
          customer: { select: { id: true, fullName: true, phone: true } },
          createdBy: { select: { id: true, fullName: true } },
          payments: true,
          _count: { select: { items: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: size,
      }),
      prisma.order.count({ where }),
    ]);
    return success(response, items, "Lấy danh sách đơn hàng thành công", paginationMeta(page, size, total));
  }),
);

router.get(
  "/drafts/mine",
  requirePermission("pos.use"),
  asyncHandler(async (request, response) => {
    const items = await prisma.order.findMany({
      where: { createdById: request.user.id, status: "DRAFT" },
      include: orderInclude,
      orderBy: { updatedAt: "desc" },
    });
    return success(response, items);
  }),
);

router.get(
  "/:id",
  requirePermission("orders.view", "pos.use"),
  asyncHandler(async (request, response) => {
    const item = await prisma.order.findUnique({ where: { id: request.params.id }, include: orderInclude });
    if (!item) throw new ApiError(404, "Không tìm thấy đơn hàng");
    return success(response, item);
  }),
);

router.post(
  "/",
  requirePermission("pos.use"),
  validate(createSchema),
  asyncHandler(async (request, response) => {
    const branchId = resolveOrderBranchId(request);
    if (!branchId) throw new ApiError(422, "Tài khoản chưa được gán chi nhánh");

    const restoredDraft = request.body.draftId
      ? await prisma.order.findFirst({
          where: {
            id: request.body.draftId,
            createdById: request.user.id,
            branchId,
            status: "DRAFT",
          },
          select: { id: true },
        })
      : null;
    if (request.body.draftId && !restoredDraft) {
      throw new ApiError(404, "Không tìm thấy đơn tạm hợp lệ để khôi phục");
    }

    const shift = await prisma.workShift.findFirst({
      where: { userId: request.user.id, branchId, status: "OPEN" },
    });
    if (!shift) throw new ApiError(422, "Bạn cần mở ca làm việc trước khi tạo đơn");

    const pricing = await calculateOrder(prisma, {
      ...request.body,
      branchId,
    });
    const status = request.body.saveAsDraft ? "DRAFT" : "COMPLETED";
    if (!request.body.saveAsDraft) {
      const paymentTotal = request.body.payments.reduce((sum, payment) => sum + payment.amount, 0);
      if (paymentTotal !== pricing.totalAmount) {
        throw new ApiError(422, "Tổng số tiền thanh toán không khớp tổng đơn do hệ thống tính");
      }
      if (request.body.customerPaid < pricing.totalAmount && request.body.payments.some((item) => item.method === "CASH")) {
        throw new ApiError(422, "Số tiền khách đưa chưa đủ");
      }
    }

    const code = createBusinessCode(request.body.saveAsDraft ? "TAM" : "HD");
    const order = await prisma.$transaction(async (tx) => {
      if (restoredDraft) {
        await tx.order.delete({ where: { id: restoredDraft.id } });
      }
      const currentPricing = await calculateOrder(tx, {
        ...request.body,
        branchId,
      });
      if (!request.body.saveAsDraft) {
        const paymentTotal = request.body.payments.reduce(
          (sum, payment) => sum + payment.amount,
          0,
        );
        if (paymentTotal !== currentPricing.totalAmount) {
          throw new ApiError(
            409,
            "Quyền lợi hoặc giá đơn vừa thay đổi; vui lòng kiểm tra lại tổng thanh toán",
          );
        }
      }
      const createdOrder = await tx.order.create({
        data: {
          ...orderDataFromPricing(request, currentPricing, branchId, shift.id, code, status),
          items: {
            create: currentPricing.lines.map((line) => ({
              productId: line.productId,
              variantId: line.variantId,
              productName: line.productName,
              variantName: line.variantName,
              sku: line.sku,
              unitPrice: line.unitPrice,
              quantity: line.quantity,
              scoopCount: line.scoopCount,
              lineTotal: line.lineTotal,
              note: line.note,
              flavors: {
                create: line.flavors.map((flavor, index) => ({
                  flavorId: flavor.id,
                  scoopNumber: index + 1,
                  extraPrice: flavor.extraPrice,
                })),
              },
              toppings: {
                create: line.toppings.map((topping) => ({
                  toppingId: topping.id,
                  quantity: 1,
                  price: topping.price,
                })),
              },
            })),
          },
          statusHistory: {
            create: { status, changedById: request.user.id, note: status === "DRAFT" ? "Lưu đơn tạm" : "Thanh toán tại POS" },
          },
          ...(!request.body.saveAsDraft
            ? {
                payments: {
                  create: request.body.payments.map((payment) => ({
                    code: createBusinessCode("TT"),
                    method: payment.method,
                    amount: payment.amount,
                    referenceCode: payment.referenceCode || null,
                  })),
                },
              }
            : {}),
        },
      });

      if (!request.body.saveAsDraft) {
        await consumeCustomerVoucher(
          tx,
          currentPricing.voucher,
          createdOrder.id,
          branchId,
        );
        await deductInventory(tx, branchId, currentPricing.lines, request.user.id, createdOrder.id);
        await updateCustomerAfterCompletion(tx, createdOrder);
        if (currentPricing.promotion) {
          await tx.promotionUsage.create({
            data: {
              promotionId: currentPricing.promotion.id,
              customerId: request.body.customerId || null,
              orderId: createdOrder.id,
              discount: currentPricing.discountAmount,
            },
          });
        }
        if (
          currentPricing.activeMembership &&
          currentPricing.membershipBenefit?.available &&
          currentPricing.membershipDiscount > 0
        ) {
          await tx.membershipBenefitUsage.create({
            data: {
              subscriptionId: currentPricing.activeMembership.id,
              orderId: createdOrder.id,
              benefitDate: benefitDateFor(),
              quantity: currentPricing.membershipBenefit.freeQuantity,
              discountAmount: currentPricing.membershipDiscount,
            },
          });
        }
        const revenueUpdate = {};
        for (const payment of request.body.payments) {
          const field = {
            CASH: "cashRevenue",
            BANK_TRANSFER: "transferRevenue",
            CARD: "cardRevenue",
            EWALLET: "ewalletRevenue",
          }[payment.method];
          revenueUpdate[field] = { increment: (revenueUpdate[field]?.increment || 0) + payment.amount };
        }
        await tx.workShift.update({ where: { id: shift.id }, data: revenueUpdate });
      }

      await tx.auditLog.create({
        data: {
          userId: request.user.id,
          action: request.body.saveAsDraft ? "ORDER_DRAFT_CREATE" : "ORDER_CHECKOUT",
          entityType: "Order",
          entityId: createdOrder.id,
          newData: { code, totalAmount: currentPricing.totalAmount, status },
          ipAddress: request.ip,
          userAgent: request.get("user-agent"),
        },
      });
      return createdOrder;
    });

    const fullOrder = await prisma.order.findUnique({ where: { id: order.id }, include: orderInclude });
    emitOrderEvent(branchId, "order:created", fullOrder);
    return created(
      response,
      fullOrder,
      request.body.saveAsDraft ? "Đã lưu đơn tạm" : "Thanh toán và tạo đơn thành công",
    );
  }),
);

router.patch(
  "/:id/status",
  requirePermission("orders.manage"),
  validate(z.object({
    status: z.enum(["PENDING", "MAKING", "READY", "COMPLETED", "CANCELLED"]),
    note: z.string().trim().max(500).optional().nullable(),
  })),
  asyncHandler(async (request, response) => {
    const existing = await prisma.order.findUnique({ where: { id: request.params.id }, include: orderInclude });
    if (!existing) throw new ApiError(404, "Không tìm thấy đơn hàng");
    const transitions = {
      DRAFT: ["PENDING", "CANCELLED"],
      PENDING: ["MAKING", "CANCELLED"],
      MAKING: ["READY", "CANCELLED"],
      READY: ["COMPLETED", "CANCELLED"],
      COMPLETED: [],
      CANCELLED: [],
    };
    if (!transitions[existing.status].includes(request.body.status)) {
      throw new ApiError(422, `Không thể chuyển từ ${existing.status} sang ${request.body.status}`);
    }
    if (request.body.status === "COMPLETED" && existing.paymentStatus !== "PAID") {
      throw new ApiError(422, "Đơn hàng phải được thanh toán trước khi hoàn thành");
    }
    if (request.body.status === "CANCELLED" && !request.body.note) {
      throw new ApiError(422, "Vui lòng nhập lý do hủy đơn");
    }

    await prisma.$transaction(async (tx) => {
      if (request.body.status === "COMPLETED") {
        const lines = existing.items.map((item) => ({
          productId: item.productId,
          variantId: item.variantId,
          quantity: item.quantity,
          flavors: item.flavors.map((itemFlavor) => ({ id: itemFlavor.flavorId })),
          toppings: item.toppings.map((itemTopping) => ({ id: itemTopping.toppingId, quantity: itemTopping.quantity })),
        }));
        await deductInventory(tx, existing.branchId, lines, request.user.id, existing.id);
        await updateCustomerAfterCompletion(tx, existing);
      }
      await tx.order.update({
        where: { id: existing.id },
        data: {
          status: request.body.status,
          ...(request.body.status === "COMPLETED" ? { completedAt: new Date() } : {}),
          ...(request.body.status === "CANCELLED"
            ? { cancelledAt: new Date(), cancellationReason: request.body.note }
            : {}),
        },
      });
      await tx.orderStatusHistory.create({
        data: {
          orderId: existing.id,
          status: request.body.status,
          changedById: request.user.id,
          note: request.body.note || null,
        },
      });
    });
    const order = await prisma.order.findUnique({ where: { id: existing.id }, include: orderInclude });
    emitOrderEvent(order.branchId, "order:updated", order);
    return success(response, order, "Cập nhật trạng thái đơn hàng thành công");
  }),
);

router.post(
  "/:id/refunds",
  requirePermission("orders.manage"),
  validate(z.object({
    amount: z.coerce.number().int().positive(),
    method: z.enum(["CASH", "BANK_TRANSFER", "CARD", "EWALLET"]),
    reason: z.string().trim().min(3).max(500),
  })),
  asyncHandler(async (request, response) => {
    const existing = await prisma.order.findUnique({
      where: { id: request.params.id },
      include: { refunds: { where: { status: "COMPLETED" } } },
    });
    if (!existing || existing.paymentStatus === "UNPAID") throw new ApiError(404, "Không tìm thấy đơn đã thanh toán");
    const refunded = existing.refunds.reduce((sum, item) => sum + item.amount, 0);
    if (request.body.amount > existing.totalAmount - refunded) {
      throw new ApiError(422, "Số tiền hoàn vượt quá số tiền còn có thể hoàn");
    }
    const refund = await prisma.$transaction(async (tx) => {
      const item = await tx.refund.create({
        data: {
          code: createBusinessCode("HT"),
          orderId: existing.id,
          createdById: request.user.id,
          amount: request.body.amount,
          method: request.body.method,
          reason: request.body.reason,
          status: "COMPLETED",
          refundedAt: new Date(),
        },
      });
      const totalRefunded = refunded + request.body.amount;
      await tx.order.update({
        where: { id: existing.id },
        data: { paymentStatus: totalRefunded >= existing.totalAmount ? "REFUNDED" : "PARTIALLY_REFUNDED" },
      });
      if (existing.shiftId) {
        await tx.workShift.update({
          where: { id: existing.shiftId },
          data: { refundAmount: { increment: request.body.amount } },
        });
      }
      return item;
    });
    emitOrderEvent(existing.branchId, "order:refunded", { orderId: existing.id, refund });
    return created(response, refund, "Hoàn tiền thành công");
  }),
);

router.get(
  "/:id/invoice.pdf",
  requirePermission("orders.view", "pos.use"),
  asyncHandler(async (request, response) => {
    const order = await prisma.order.findUnique({ where: { id: request.params.id }, include: orderInclude });
    if (!order) throw new ApiError(404, "Không tìm thấy đơn hàng");
    response.setHeader("Content-Type", "application/pdf");
    response.setHeader("Content-Disposition", `inline; filename="${order.code}.pdf"`);
    const document = new PDFDocument({
      size: "A5",
      margin: 24,
      bufferPages: true,
      autoFirstPage: true,
    });
    document.pipe(response);
    renderInvoicePdf(document, order);
    document.end();
  }),
);

export default router;
