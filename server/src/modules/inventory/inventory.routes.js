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
  consumeInventoryBatches,
  createAdjustmentBatch,
  normalizeStockQuantity,
} from "../../services/inventory-batch.service.js";
import {
  assertBranchAccess,
  branchWhere,
  resolveBranchIds,
} from "../../services/branch-access.service.js";

const router = Router();
router.use(authenticate);

const ingredientSchema = z.object({
  code: z.string().trim().min(2).max(40).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2).max(120),
  unit: z.string().trim().min(1).max(20),
  minStock: z.coerce.number().min(0).default(0),
  lastCost: z.coerce.number().int().min(0).default(0),
  averageCost: z.coerce.number().int().min(0).default(0),
  supplierId: z.string().optional().nullable(),
  defaultExpiryDays: z.coerce.number().int().positive().optional().nullable(),
  warehouseLocation: z.string().trim().max(100).optional().nullable(),
  isActive: z.boolean().default(true),
});

const stockLineSchema = z.object({
  ingredientId: z.string().min(1),
  quantity: z.coerce.number().positive().max(1000000000),
});

const stockIssueSchema = z.object({
  branchId: z.string().min(1),
  reason: z.enum(["INTERNAL_USE", "DAMAGED", "EXPIRED", "SAMPLE", "OTHER"]),
  note: z.string().trim().max(500).optional().nullable(),
  items: z.array(stockLineSchema).min(1).max(100),
}).superRefine((data, context) => {
  const ids = data.items.map((item) => item.ingredientId);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["items"],
      message: "Một nguyên liệu không được xuất nhiều dòng trong cùng phiếu",
    });
  }
  if (data.reason === "OTHER" && (!data.note || data.note.trim().length < 3)) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["note"],
      message: "Vui lòng nhập lý do xuất kho",
    });
  }
});

const stocktakeSchema = z.object({
  branchId: z.string().min(1),
  note: z.string().trim().max(500).optional().nullable(),
  items: z.array(z.object({
    ingredientId: z.string().min(1),
    actualQuantity: z.coerce.number().min(0).max(1000000000),
  })).min(1).max(500),
}).superRefine((data, context) => {
  const ids = data.items.map((item) => item.ingredientId);
  if (new Set(ids).size !== ids.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["items"],
      message: "Một nguyên liệu không được kiểm đếm nhiều lần",
    });
  }
});

const issueReasonLabels = {
  INTERNAL_USE: "Sử dụng nội bộ",
  DAMAGED: "Hư hỏng",
  EXPIRED: "Hết hạn",
  SAMPLE: "Dùng thử / mẫu",
  OTHER: "Lý do khác",
};


const stockIssueInclude = {
  branch: { select: { id: true, code: true, name: true } },
  createdBy: { select: { id: true, fullName: true } },
  items: {
    include: { ingredient: { select: { id: true, code: true, name: true, unit: true } } },
    orderBy: { createdAt: "asc" },
  },
};

const stocktakeInclude = {
  branch: { select: { id: true, code: true, name: true } },
  createdBy: { select: { id: true, fullName: true } },
  items: {
    include: { ingredient: { select: { id: true, code: true, name: true, unit: true } } },
    orderBy: { createdAt: "asc" },
  },
};

router.get(
  "/",
  requirePermission("inventory.view"),
  asyncHandler(async (request, response) => {
    const { page, size, skip } = getPagination(request.query);
    const branchIds = await resolveBranchIds(
      prisma,
      request.user,
      request.query.branchId || null,
    );
    const search = String(request.query.search || "").trim();
    const where = {
      ...branchWhere(branchIds),
      ...(search
        ? {
            ingredient: {
              OR: [{ name: { contains: search } }, { code: { contains: search } }],
            },
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.inventory.findMany({
        where,
        include: {
          branch: { select: { id: true, code: true, name: true } },
          ingredient: { include: { supplier: true } },
        },
        skip,
        take: size,
        orderBy: { ingredient: { name: "asc" } },
      }),
      prisma.inventory.count({ where }),
    ]);
    const data = items.map((item) => ({
      ...item,
      isLowStock: item.quantity <= item.ingredient.minStock,
    }));
    return success(response, data, "Lấy tồn kho thành công", paginationMeta(page, size, total));
  }),
);

router.get(
  "/alerts",
  requirePermission("inventory.view", "dashboard.view"),
  asyncHandler(async (request, response) => {
    const branchIds = await resolveBranchIds(
      prisma,
      request.user,
      request.query.branchId || null,
    );
    const inventories = await prisma.inventory.findMany({
      where: branchWhere(branchIds),
      include: { ingredient: true, branch: { select: { id: true, name: true } } },
    });
    const expiringBatches = await prisma.inventoryBatch.findMany({
      where: {
        ...branchWhere(branchIds),
        remaining: { gt: 0 },
        expiryDate: { lte: new Date(Date.now() + 14 * 86400000), gte: new Date() },
      },
      include: { ingredient: true, branch: { select: { id: true, name: true } } },
      orderBy: { expiryDate: "asc" },
      take: 30,
    });
    return success(response, {
      lowStock: inventories.filter((item) => item.quantity <= item.ingredient.minStock),
      expiringBatches,
    });
  }),
);

router.get(
  "/ingredients",
  requirePermission("inventory.view"),
  asyncHandler(async (request, response) => {
    const items = await prisma.ingredient.findMany({
      where: { deletedAt: null },
      include: { supplier: true },
      orderBy: { name: "asc" },
    });
    return success(response, items);
  }),
);

router.post(
  "/ingredients",
  requirePermission("inventory.manage"),
  validate(ingredientSchema),
  asyncHandler(async (request, response) => {
    const item = await prisma.$transaction(async (tx) => {
      const ingredient = await tx.ingredient.create({ data: request.body });
      const branches = await tx.branch.findMany({ where: { isActive: true, deletedAt: null } });
      await tx.inventory.createMany({
        data: branches.map((branch) => ({
          branchId: branch.id,
          ingredientId: ingredient.id,
          quantity: 0,
          lastCost: ingredient.lastCost,
          averageCost: ingredient.averageCost,
        })),
      });
      return ingredient;
    });
    return created(response, item, "Tạo nguyên liệu thành công");
  }),
);

router.get(
  "/transactions",
  requirePermission("inventory.view"),
  asyncHandler(async (request, response) => {
    const { page, size, skip } = getPagination(request.query);
    const branchIds = await resolveBranchIds(
      prisma,
      request.user,
      request.query.branchId || null,
    );
    const where = {
      ...branchWhere(branchIds),
      ...(request.query.ingredientId ? { ingredientId: request.query.ingredientId } : {}),
      ...(request.query.type ? { type: request.query.type } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.inventoryTransaction.findMany({
        where,
        include: {
          ingredient: true,
          branch: { select: { id: true, name: true } },
          createdBy: { select: { id: true, fullName: true } },
        },
        orderBy: { createdAt: "desc" },
        skip,
        take: size,
      }),
      prisma.inventoryTransaction.count({ where }),
    ]);
    return success(response, items, "Lấy lịch sử kho thành công", paginationMeta(page, size, total));
  }),
);

router.get(
  "/issues",
  requirePermission("inventory.view"),
  asyncHandler(async (request, response) => {
    const { page, size, skip } = getPagination(request.query);
    const branchIds = await resolveBranchIds(
      prisma,
      request.user,
      request.query.branchId || null,
    );
    const where = branchWhere(branchIds);
    const [items, total] = await Promise.all([
      prisma.stockIssue.findMany({
        where,
        include: stockIssueInclude,
        orderBy: { createdAt: "desc" },
        skip,
        take: size,
      }),
      prisma.stockIssue.count({ where }),
    ]);
    return success(
      response,
      items,
      "Lấy lịch sử xuất kho thành công",
      paginationMeta(page, size, total),
    );
  }),
);

router.post(
  "/issues",
  requirePermission("inventory.manage"),
  validate(stockIssueSchema),
  asyncHandler(async (request, response) => {
    await assertBranchAccess(
      prisma,
      request.user,
      request.body.branchId,
      "Bạn chỉ được thao tác kho tại chi nhánh được phân công",
    );
    const item = await prisma.$transaction(async (tx) => {
      const code = createBusinessCode("PXK");
      const issue = await tx.stockIssue.create({
        data: {
          code,
          branchId: request.body.branchId,
          createdById: request.user.id,
          reason: request.body.reason,
          note: request.body.note || null,
        },
      });

      let totalCost = 0;
      for (const [lineIndex, line] of request.body.items.entries()) {
        const inventory = await tx.inventory.findUnique({
          where: {
            branchId_ingredientId: {
              branchId: request.body.branchId,
              ingredientId: line.ingredientId,
            },
          },
          include: { ingredient: true },
        });
        if (!inventory) {
          throw new ApiError(404, "Không tìm thấy nguyên liệu trong kho chi nhánh");
        }

        const quantity = normalizeStockQuantity(line.quantity);
        const updatedResult = await tx.inventory.updateMany({
          where: { id: inventory.id, quantity: { gte: quantity } },
          data: { quantity: { decrement: quantity } },
        });
        if (!updatedResult.count) {
          throw new ApiError(
            422,
            `${inventory.ingredient.name} không đủ tồn kho: còn ${inventory.quantity.toLocaleString("vi-VN")} ${inventory.ingredient.unit}`,
          );
        }

        const batchCost = await consumeInventoryBatches(tx, {
          branchId: request.body.branchId,
          ingredientId: line.ingredientId,
          quantity,
          ingredientName: inventory.ingredient.name,
        });
        const updatedInventory = await tx.inventory.findUnique({
          where: { id: inventory.id },
        });
        totalCost += batchCost.totalCost;

        await tx.stockIssueItem.create({
          data: {
            stockIssueId: issue.id,
            ingredientId: line.ingredientId,
            quantity,
            unitCost: batchCost.unitCost,
            lineCost: batchCost.totalCost,
          },
        });
        await tx.inventoryTransaction.create({
          data: {
            code: `${code}-${String(lineIndex + 1).padStart(3, "0")}`,
            type: request.body.reason === "DAMAGED" || request.body.reason === "EXPIRED"
              ? "WASTE"
              : "ADJUST_OUT",
            branchId: request.body.branchId,
            ingredientId: line.ingredientId,
            quantity: -quantity,
            balanceAfter: updatedInventory.quantity,
            unitCost: batchCost.unitCost,
            referenceType: "StockIssue",
            referenceId: issue.id,
            note: `${issueReasonLabels[request.body.reason]} - phiếu ${code}${request.body.note ? `: ${request.body.note}` : ""}`,
            createdById: request.user.id,
          },
        });
      }

      await tx.stockIssue.update({
        where: { id: issue.id },
        data: { totalCost },
      });
      await tx.auditLog.create({
        data: {
          userId: request.user.id,
          action: "STOCK_ISSUE_CREATE",
          entityType: "StockIssue",
          entityId: issue.id,
          newData: {
            code,
            branchId: request.body.branchId,
            reason: request.body.reason,
            itemCount: request.body.items.length,
            totalCost,
          },
          ipAddress: request.ip,
          userAgent: request.get("user-agent"),
        },
      });
      return tx.stockIssue.findUnique({
        where: { id: issue.id },
        include: stockIssueInclude,
      });
    });
    return created(response, item, "Xuất kho thành công");
  }),
);

router.get(
  "/stocktakes",
  requirePermission("inventory.view"),
  asyncHandler(async (request, response) => {
    const { page, size, skip } = getPagination(request.query);
    const branchIds = await resolveBranchIds(
      prisma,
      request.user,
      request.query.branchId || null,
    );
    const where = branchWhere(branchIds);
    const [items, total] = await Promise.all([
      prisma.stocktake.findMany({
        where,
        include: stocktakeInclude,
        orderBy: { createdAt: "desc" },
        skip,
        take: size,
      }),
      prisma.stocktake.count({ where }),
    ]);
    return success(
      response,
      items,
      "Lấy lịch sử kiểm kho thành công",
      paginationMeta(page, size, total),
    );
  }),
);

router.post(
  "/stocktakes",
  requirePermission("inventory.manage"),
  validate(stocktakeSchema),
  asyncHandler(async (request, response) => {
    await assertBranchAccess(
      prisma,
      request.user,
      request.body.branchId,
      "Bạn chỉ được thao tác kho tại chi nhánh được phân công",
    );
    const item = await prisma.$transaction(async (tx) => {
      const code = createBusinessCode("KK");
      const stocktake = await tx.stocktake.create({
        data: {
          code,
          branchId: request.body.branchId,
          createdById: request.user.id,
          note: request.body.note || null,
        },
      });

      let totalVarianceCost = 0;
      let differenceCount = 0;
      for (const [lineIndex, line] of request.body.items.entries()) {
        const inventory = await tx.inventory.findUnique({
          where: {
            branchId_ingredientId: {
              branchId: request.body.branchId,
              ingredientId: line.ingredientId,
            },
          },
          include: { ingredient: true },
        });
        if (!inventory) {
          throw new ApiError(404, "Không tìm thấy nguyên liệu trong kho chi nhánh");
        }

        const systemQuantity = normalizeStockQuantity(inventory.quantity);
        const actualQuantity = normalizeStockQuantity(line.actualQuantity);
        const difference = normalizeStockQuantity(actualQuantity - systemQuantity);
        if (difference !== 0) differenceCount += 1;
      let unitCost = inventory.averageCost;
        let varianceCost = Math.round(difference * unitCost);

        if (difference < 0) {
          const batchCost = await consumeInventoryBatches(tx, {
            branchId: request.body.branchId,
            ingredientId: line.ingredientId,
            quantity: Math.abs(difference),
            ingredientName: inventory.ingredient.name,
          });
          unitCost = batchCost.unitCost;
          varianceCost = -batchCost.totalCost;
        } else if (difference > 0) {
          await createAdjustmentBatch(tx, {
            branchId: request.body.branchId,
            ingredientId: line.ingredientId,
            quantity: difference,
            unitCost,
            batchNumber: `${code}-${inventory.ingredient.code}`,
          });
        }

        if (difference !== 0) {
          await tx.inventory.update({
            where: { id: inventory.id },
            data: { quantity: actualQuantity },
          });
        }
        totalVarianceCost += varianceCost;
        await tx.stocktakeItem.create({
          data: {
            stocktakeId: stocktake.id,
            ingredientId: line.ingredientId,
            systemQuantity,
            actualQuantity,
            difference,
            unitCost,
            varianceCost,
          },
        });
        await tx.inventoryTransaction.create({
          data: {
            code: `${code}-${String(lineIndex + 1).padStart(3, "0")}`,
            type: "STOCKTAKE",
            branchId: request.body.branchId,
            ingredientId: line.ingredientId,
            quantity: difference,
            balanceAfter: actualQuantity,
            unitCost,
            referenceType: "Stocktake",
            referenceId: stocktake.id,
            note: `Kiểm kho ${code}${request.body.note ? `: ${request.body.note}` : ""}`,
            createdById: request.user.id,
          },
        });
      }

      await tx.stocktake.update({
        where: { id: stocktake.id },
        data: { totalVarianceCost },
      });
      await tx.auditLog.create({
        data: {
          userId: request.user.id,
          action: "STOCKTAKE_COMPLETE",
          entityType: "Stocktake",
          entityId: stocktake.id,
          newData: {
            code,
            branchId: request.body.branchId,
            itemCount: request.body.items.length,
            differenceCount,
            totalVarianceCost,
          },
          ipAddress: request.ip,
          userAgent: request.get("user-agent"),
        },
      });
      return tx.stocktake.findUnique({
        where: { id: stocktake.id },
        include: stocktakeInclude,
      });
    });
    return created(response, item, "Hoàn tất kiểm kho");
  }),
);

router.post(
  "/adjust",
  requirePermission("inventory.manage"),
  validate(z.object({
    branchId: z.string().min(1),
    ingredientId: z.string().min(1),
    type: z.enum(["ADJUST_IN", "ADJUST_OUT", "WASTE", "STOCKTAKE"]),
    quantity: z.coerce.number().positive(),
    note: z.string().trim().min(3).max(500),
  })),
  asyncHandler(async (request, response) => {
    const { branchId, ingredientId, type, quantity, note } = request.body;
    await assertBranchAccess(
      prisma,
      request.user,
      branchId,
      "Bạn chỉ được thao tác kho tại chi nhánh được phân công",
    );
    const adjustment = await prisma.$transaction(async (tx) => {
      const inventory = await tx.inventory.findUnique({
        where: { branchId_ingredientId: { branchId, ingredientId } },
        include: { ingredient: true },
      });
      if (!inventory) throw new ApiError(404, "Không tìm thấy tồn kho nguyên liệu");
      const decrease = ["ADJUST_OUT", "WASTE"].includes(type);
      const delta = normalizeStockQuantity(
        type === "STOCKTAKE"
          ? quantity - inventory.quantity
          : decrease
            ? -quantity
            : quantity,
      );
      if (inventory.quantity + delta < 0) throw new ApiError(422, "Điều chỉnh sẽ làm tồn kho âm");
      const transactionCode = createBusinessCode("KHO");
        let unitCost = inventory.averageCost;
      if (delta < 0) {
        const batchCost = await consumeInventoryBatches(tx, {
          branchId,
          ingredientId,
          quantity: Math.abs(delta),
          ingredientName: inventory.ingredient.name,
        });
        unitCost = batchCost.unitCost;
      } else if (delta > 0) {
        await createAdjustmentBatch(tx, {
          branchId,
          ingredientId,
          quantity: delta,
          unitCost,
          batchNumber: `DC-${transactionCode}`,
        });
      }
      const updated = await tx.inventory.update({
        where: { id: inventory.id },
        data: { quantity: normalizeStockQuantity(inventory.quantity + delta) },
      });
      const transaction = await tx.inventoryTransaction.create({
        data: {
          code: transactionCode,
          type,
          branchId,
          ingredientId,
          quantity: delta,
          balanceAfter: updated.quantity,
          unitCost,
          referenceType: "InventoryAdjustment",
          referenceId: transactionCode,
          note,
          createdById: request.user.id,
        },
      });
      await tx.auditLog.create({
        data: {
          userId: request.user.id,
          action: "INVENTORY_ADJUST",
          entityType: "Inventory",
          entityId: inventory.id,
          oldData: { quantity: inventory.quantity },
          newData: { quantity: updated.quantity, type, note },
          ipAddress: request.ip,
          userAgent: request.get("user-agent"),
        },
      });
      return { inventory: updated, transaction };
    });
    return success(response, adjustment, "Điều chỉnh tồn kho thành công");
  }),
);

router.post(
  "/transfer",
  requirePermission("inventory.manage"),
  validate(z.object({
    fromBranchId: z.string().min(1),
    toBranchId: z.string().min(1),
    ingredientId: z.string().min(1),
    quantity: z.coerce.number().positive(),
    note: z.string().trim().min(3).max(500),
  }).refine((data) => data.fromBranchId !== data.toBranchId, {
    message: "Chi nhánh nhận phải khác chi nhánh gửi",
    path: ["toBranchId"],
  })),
  asyncHandler(async (request, response) => {
    const { fromBranchId, toBranchId, ingredientId, quantity, note } = request.body;
    await Promise.all([
      assertBranchAccess(
        prisma,
        request.user,
        fromBranchId,
        "Bạn chỉ được chuyển hàng từ kho thuộc chi nhánh mình quản lý",
      ),
      assertBranchAccess(
        prisma,
        request.user,
        toBranchId,
        "Bạn chỉ được chuyển hàng đến kho thuộc chi nhánh mình quản lý",
      ),
    ]);
    const data = await prisma.$transaction(async (tx) => {
      const [source, target] = await Promise.all([
        tx.inventory.findUnique({ where: { branchId_ingredientId: { branchId: fromBranchId, ingredientId } } }),
        tx.inventory.findUnique({ where: { branchId_ingredientId: { branchId: toBranchId, ingredientId } } }),
      ]);
      if (!source || !target) throw new ApiError(404, "Không tìm thấy tồn kho tại chi nhánh");
      if (source.quantity < quantity) throw new ApiError(422, "Chi nhánh xuất không đủ tồn kho");
      const updatedSource = await tx.inventory.update({
        where: { id: source.id },
        data: { quantity: { decrement: quantity } },
      });
      const updatedTarget = await tx.inventory.update({
        where: { id: target.id },
        data: { quantity: { increment: quantity } },
      });
      const common = { fromBranchId, toBranchId, ingredientId, note, createdById: request.user.id };
      await tx.inventoryTransaction.createMany({
        data: [
          {
            ...common,
            code: createBusinessCode("KHO"),
            type: "TRANSFER_OUT",
            branchId: fromBranchId,
            quantity: -quantity,
            balanceAfter: updatedSource.quantity,
          },
          {
            ...common,
            code: createBusinessCode("KHO"),
            type: "TRANSFER_IN",
            branchId: toBranchId,
            quantity,
            balanceAfter: updatedTarget.quantity,
          },
        ],
      });
      return { source: updatedSource, target: updatedTarget };
    });
    return success(response, data, "Chuyển kho thành công");
  }),
);

export default router;
