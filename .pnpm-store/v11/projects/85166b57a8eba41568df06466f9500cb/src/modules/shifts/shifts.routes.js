import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { authenticate, requirePermission } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validate.js";
import { ApiError } from "../../utils/api-error.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { createBusinessCode } from "../../utils/code.js";
import { created, success } from "../../utils/response.js";

const router = Router();
router.use(authenticate, requirePermission("shifts.manage"));

const shiftInclude = {
  branch: { select: { id: true, code: true, name: true } },
  user: { select: { id: true, fullName: true, username: true } },
  expenses: { include: { createdBy: { select: { id: true, fullName: true } } } },
  orders: {
    select: {
      id: true,
      code: true,
      totalAmount: true,
      status: true,
      paymentStatus: true,
      createdAt: true,
      payments: true,
      refunds: true,
    },
    orderBy: { createdAt: "desc" },
  },
};

router.get(
  "/current",
  asyncHandler(async (request, response) => {
    const shift = await prisma.workShift.findFirst({
      where: { userId: request.user.id, status: "OPEN" },
      include: shiftInclude,
      orderBy: { openedAt: "desc" },
    });
    return success(response, shift);
  }),
);

router.get(
  "/",
  asyncHandler(async (request, response) => {
    const where = {
      ...(request.query.branchId ? { branchId: request.query.branchId } : {}),
      ...(request.query.status ? { status: request.query.status } : {}),
      ...(!["ADMIN", "MANAGER"].includes(request.user.role.code) ? { userId: request.user.id } : {}),
    };
    const shifts = await prisma.workShift.findMany({
      where,
      include: {
        branch: { select: { id: true, code: true, name: true } },
        user: { select: { id: true, fullName: true } },
        _count: { select: { orders: true, expenses: true } },
      },
      orderBy: { openedAt: "desc" },
      take: 100,
    });
    return success(response, shifts);
  }),
);

router.post(
  "/open",
  validate(z.object({
    branchId: z.string().optional().nullable(),
    openingCash: z.coerce.number().int().min(0).max(100000000),
    note: z.string().trim().max(500).optional().nullable(),
  })),
  asyncHandler(async (request, response) => {
    const branchId = request.body.branchId || request.user.branch?.id;
    if (!branchId) throw new ApiError(422, "Tài khoản chưa được gán chi nhánh");
    const existing = await prisma.workShift.findFirst({
      where: { userId: request.user.id, branchId, status: "OPEN" },
    });
    if (existing) throw new ApiError(422, "Bạn đang có một ca mở tại chi nhánh này");
    const shift = await prisma.workShift.create({
      data: {
        code: createBusinessCode("CA"),
        branchId,
        userId: request.user.id,
        openingCash: request.body.openingCash,
        note: request.body.note || null,
      },
      include: shiftInclude,
    });
    return created(response, shift, "Mở ca làm việc thành công");
  }),
);

router.post(
  "/:id/expenses",
  validate(z.object({
    category: z.string().trim().min(2).max(100),
    amount: z.coerce.number().int().positive(),
    description: z.string().trim().min(3).max(500),
  })),
  asyncHandler(async (request, response) => {
    const shift = await prisma.workShift.findUnique({ where: { id: request.params.id } });
    if (!shift || shift.status !== "OPEN") throw new ApiError(422, "Ca không tồn tại hoặc đã đóng");
    if (shift.userId !== request.user.id && !["ADMIN", "MANAGER"].includes(request.user.role.code)) {
      throw new ApiError(403, "Bạn không thể ghi chi phí cho ca của người khác");
    }
    const expense = await prisma.$transaction(async (tx) => {
      const item = await tx.shiftExpense.create({
        data: {
          shiftId: shift.id,
          createdById: request.user.id,
          category: request.body.category,
          amount: request.body.amount,
          description: request.body.description,
        },
      });
      await tx.workShift.update({
        where: { id: shift.id },
        data: { expenseAmount: { increment: request.body.amount } },
      });
      return item;
    });
    return created(response, expense, "Ghi nhận chi phí thành công");
  }),
);

router.post(
  "/:id/close",
  validate(z.object({
    countedCash: z.coerce.number().int().min(0),
    note: z.string().trim().max(500).optional().nullable(),
  })),
  asyncHandler(async (request, response) => {
    const existing = await prisma.workShift.findUnique({ where: { id: request.params.id } });
    if (!existing || existing.status !== "OPEN") throw new ApiError(422, "Ca không tồn tại hoặc đã đóng");
    if (existing.userId !== request.user.id && !["ADMIN", "MANAGER"].includes(request.user.role.code)) {
      throw new ApiError(403, "Bạn không thể đóng ca của người khác");
    }
    const expectedCash =
      existing.openingCash + existing.cashRevenue - existing.refundAmount - existing.expenseAmount;
    const shift = await prisma.workShift.update({
      where: { id: existing.id },
      data: {
        status: "CLOSED",
        countedCash: request.body.countedCash,
        expectedCash,
        difference: request.body.countedCash - expectedCash,
        closedAt: new Date(),
        note: request.body.note || existing.note,
      },
      include: shiftInclude,
    });
    return success(response, shift, "Đóng ca thành công");
  }),
);

export default router;

