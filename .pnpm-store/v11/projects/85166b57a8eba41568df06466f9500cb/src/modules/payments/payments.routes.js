import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { authenticate, requirePermission } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { ApiError } from "../../utils/api-error.js";
import { createBusinessCode } from "../../utils/code.js";
import { created, success } from "../../utils/response.js";

const router = Router();
router.use(authenticate);

router.get(
  "/order/:orderId",
  requirePermission("orders.view"),
  asyncHandler(async (request, response) => {
    const payments = await prisma.payment.findMany({
      where: { orderId: request.params.orderId },
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
    const order = await prisma.order.findUnique({
      where: { id: request.params.orderId },
      include: { payments: true },
    });
    if (!order || ["CANCELLED", "COMPLETED"].includes(order.status)) {
      throw new ApiError(422, "Đơn không tồn tại hoặc không thể thanh toán thêm");
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
      await tx.order.update({
        where: { id: order.id },
        data: {
          customerPaid: totalPaid,
          paymentStatus: totalPaid === order.totalAmount ? "PAID" : "PARTIALLY_PAID",
        },
      });
      return item;
    });
    return created(response, payment, "Ghi nhận thanh toán thành công");
  }),
);

export default router;

