import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { authenticate, requirePermission } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { ApiError } from "../../utils/api-error.js";
import { createBusinessCode } from "../../utils/code.js";
import { created, success } from "../../utils/response.js";
import { emitOrderEvent } from "../../services/socket.service.js";
import { branchWhere, resolveBranchIds } from "../../services/branch-access.service.js";

const router = Router();
router.use(authenticate);

router.get(
  "/order/:orderId",
  requirePermission("orders.view"),
  asyncHandler(async (request, response) => {
    const branchIds = await resolveBranchIds(prisma, request.user);
    const order = await prisma.order.findFirst({
      where: { id: request.params.orderId, ...branchWhere(branchIds) },
      select: { id: true },
    });
    if (!order) throw new ApiError(404, "Không tìm thấy đơn hàng");
    const payments = await prisma.payment.findMany({
      where: { orderId: order.id },
      orderBy: { paidAt: "asc" },
    });
    return success(response, payments);
  }),
);

router.post(
  "/order/:orderId",
  requirePermission("orders.manage"),
  validate(z.object({
    method: z.enum(["CASH", "BANK_TRANSFER", "CARD", "EWALLET"]),
    amount: z.coerce.number().int().positive(),
    referenceCode: z.string().trim().max(100).optional().nullable(),
  })),
  asyncHandler(async (request, response) => {
    const branchIds = await resolveBranchIds(prisma, request.user);
    const order = await prisma.order.findFirst({
      where: { id: request.params.orderId, ...branchWhere(branchIds) },
      include: { payments: true },
    });
    if (!order) throw new ApiError(404, "Không tìm thấy đơn hàng");
    if (["CANCELLED", "COMPLETED"].includes(order.status)) {
      throw new ApiError(422, "Đơn hàng không thể thanh toán thêm");
    }
    const paid = order.payments.reduce((sum, item) => sum + item.amount, 0);
    if (paid + request.body.amount > order.totalAmount) {
      throw new ApiError(422, "Số tiền thanh toán vượt quá số tiền còn lại");
    }
    const payment = await prisma.$transaction(async (tx) => {
      const item = await tx.payment.create({
        data: {
          code: createBusinessCode("TT"),
          orderId: order.id,
          ...request.body,
          referenceCode: request.body.referenceCode || null,
        },
      });
      const totalPaid = paid + request.body.amount;
      const nextPaymentStatus = totalPaid === order.totalAmount ? "PAID" : "PARTIALLY_PAID";
      await tx.order.update({
        where: { id: order.id },
        data: {
          customerPaid: totalPaid,
          paymentStatus: nextPaymentStatus,
        },
      });
      await tx.paymentStatusHistory.create({
        data: {
          orderId: order.id,
          fromStatus: order.paymentStatus,
          status: nextPaymentStatus,
          changedById: request.user.id,
          amount: request.body.amount,
          method: request.body.method,
          note: request.body.referenceCode ? `Mã tham chiếu: ${request.body.referenceCode}` : "Ghi nhận thanh toán",
        },
      });
      const revenueField = { CASH: "cashRevenue", BANK_TRANSFER: "transferRevenue", CARD: "cardRevenue", EWALLET: "ewalletRevenue" }[request.body.method];
      if (order.shiftId && revenueField) {
        await tx.workShift.update({ where: { id: order.shiftId }, data: { [revenueField]: { increment: request.body.amount } } });
      }
      return item;
    });
    emitOrderEvent(order.branchId, "order:updated", { id: order.id, orderId: order.id });
    return created(response, payment, "Ghi nhận thanh toán thành công");
  }),
);

export default router;
