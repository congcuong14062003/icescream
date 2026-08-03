import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { authenticate, requirePermission } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { ApiError } from "../../utils/api-error.js";
import { createBusinessCode } from "../../utils/code.js";
import { getPagination, paginationMeta } from "../../utils/pagination.js";
import { created, success } from "../../utils/response.js";
import {
  assertBranchAccess,
  branchWhere,
  resolveBranchIds,
} from "../../services/branch-access.service.js";

const router = Router();
router.use(authenticate, requirePermission("inventory.manage", "suppliers.manage"));

const itemSchema = z.object({
  ingredientId: z.string().min(1),
  quantity: z.coerce.number().positive(),
  unitCost: z.coerce.number().int().min(0),
  batchNumber: z.string().trim().min(2).max(80),
  manufactureDate: z.preprocess(
    (value) => (value === "" || value == null ? null : value),
    z.coerce.date().nullable(),
  ).optional(),
  expiryDate: z.preprocess(
    (value) => (value === "" || value == null ? null : value),
    z.coerce.date().nullable(),
  ).optional(),
});

const createSchema = z.object({
  supplierId: z.string().min(1),
  branchId: z.string().min(1),
  note: z.string().trim().max(1000).optional().nullable(),
  items: z.array(itemSchema).min(1),
});

const include = {
  supplier: true,
  branch: { select: { id: true, code: true, name: true } },
  createdBy: { select: { id: true, fullName: true } },
  items: { include: { ingredient: true } },
};

router.get(
  "/",
  asyncHandler(async (request, response) => {
    const { page, size, skip } = getPagination(request.query);
    const branchIds = await resolveBranchIds(
      prisma,
      request.user,
      request.query.branchId || null,
    );
    const where = {
      ...branchWhere(branchIds),
      ...(request.query.status ? { status: request.query.status } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.purchaseOrder.findMany({ where, include, orderBy: { createdAt: "desc" }, skip, take: size }),
      prisma.purchaseOrder.count({ where }),
    ]);
    return success(response, items, "Lấy phiếu nhập thành công", paginationMeta(page, size, total));
  }),
);

router.get(
  "/:id",
  asyncHandler(async (request, response) => {
    const branchIds = await resolveBranchIds(prisma, request.user);
    const item = await prisma.purchaseOrder.findFirst({
      where: { id: request.params.id, ...branchWhere(branchIds) },
      include,
    });
    if (!item) throw new ApiError(404, "Không tìm thấy phiếu nhập");
    return success(response, item);
  }),
);

router.post(
  "/",
  validate(createSchema),
  asyncHandler(async (request, response) => {
    await assertBranchAccess(
      prisma,
      request.user,
      request.body.branchId,
      "Bạn chỉ được tạo phiếu nhập cho kho thuộc chi nhánh mình quản lý",
    );
    const totalAmount = request.body.items.reduce(
      (sum, item) => sum + Math.round(item.quantity * item.unitCost),
      0,
    );
    const item = await prisma.purchaseOrder.create({
      data: {
        code: createBusinessCode("PN"),
        supplierId: request.body.supplierId,
        branchId: request.body.branchId,
        createdById: request.user.id,
        totalAmount,
        note: request.body.note || null,
        items: {
          create: request.body.items.map((line) => ({
            ...line,
            lineTotal: Math.round(line.quantity * line.unitCost),
          })),
        },
      },
      include,
    });
    return created(response, item, "Tạo phiếu nhập thành công");
  }),
);

router.patch(
  "/:id/status",
  validate(z.object({
    status: z.enum(["PENDING", "APPROVED", "RECEIVED", "CANCELLED"]),
  })),
  asyncHandler(async (request, response) => {
    const branchIds = await resolveBranchIds(prisma, request.user);
    const existing = await prisma.purchaseOrder.findFirst({
      where: { id: request.params.id, ...branchWhere(branchIds) },
      include: { items: true },
    });
    if (!existing) throw new ApiError(404, "Không tìm thấy phiếu nhập");
    const transitions = {
      DRAFT: ["PENDING", "CANCELLED"],
      PENDING: ["APPROVED", "CANCELLED"],
      APPROVED: ["RECEIVED", "CANCELLED"],
      RECEIVED: [],
      CANCELLED: [],
    };
    if (!transitions[existing.status].includes(request.body.status)) {
      throw new ApiError(422, `Không thể chuyển từ ${existing.status} sang ${request.body.status}`);
    }

    await prisma.$transaction(async (tx) => {
      if (request.body.status === "RECEIVED") {
        for (const line of existing.items) {
          const before = await tx.inventory.findUnique({
            where: {
              branchId_ingredientId: {
                branchId: existing.branchId,
                ingredientId: line.ingredientId,
              },
            },
          });
          const inventory = await tx.inventory.upsert({
            where: {
              branchId_ingredientId: {
                branchId: existing.branchId,
                ingredientId: line.ingredientId,
              },
            },
            update: {
              quantity: { increment: line.quantity },
              lastCost: line.unitCost,
              averageCost: (() => {
                const currentCost = before?.averageCost || 0;
                return before && before.quantity > 0
                  ? Math.round((before.quantity * currentCost + line.quantity * line.unitCost) / (before.quantity + line.quantity))
                  : line.unitCost;
              })(),
            },
            create: {
              branchId: existing.branchId,
              ingredientId: line.ingredientId,
              quantity: line.quantity,
              lastCost: line.unitCost,
              averageCost: line.unitCost,
            },
          });
          await tx.inventoryBatch.create({
            data: {
              branchId: existing.branchId,
              ingredientId: line.ingredientId,
              purchaseItemId: line.id,
              batchNumber: line.batchNumber,
              manufactureDate: line.manufactureDate,
              expiryDate: line.expiryDate,
              quantity: line.quantity,
              remaining: line.quantity,
              unitCost: line.unitCost,
            },
          });
          await tx.inventoryTransaction.create({
            data: {
              code: createBusinessCode("KHO"),
              type: "IMPORT",
              branchId: existing.branchId,
              ingredientId: line.ingredientId,
              quantity: line.quantity,
              balanceAfter: inventory.quantity,
              unitCost: line.unitCost,
              referenceType: "PurchaseOrder",
              referenceId: existing.id,
              note: `Nhập kho từ phiếu ${existing.code}`,
              createdById: request.user.id,
            },
          });
        }
        await tx.supplier.update({
          where: { id: existing.supplierId },
          data: { outstandingDebt: { increment: existing.totalAmount } },
        });
      }
      await tx.purchaseOrder.update({
        where: { id: existing.id },
        data: {
          status: request.body.status,
          ...(request.body.status === "APPROVED" ? { approvedAt: new Date() } : {}),
          ...(request.body.status === "RECEIVED" ? { receivedAt: new Date() } : {}),
          ...(request.body.status === "CANCELLED" ? { cancelledAt: new Date() } : {}),
        },
      });
    });
    const item = await prisma.purchaseOrder.findUnique({ where: { id: existing.id }, include });
    return success(response, item, "Cập nhật phiếu nhập thành công");
  }),
);

export default router;
