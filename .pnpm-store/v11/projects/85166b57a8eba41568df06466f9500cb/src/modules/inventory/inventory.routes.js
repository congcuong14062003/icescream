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

router.get(
  "/",
  requirePermission("inventory.view"),
  asyncHandler(async (request, response) => {
    const { page, size, skip } = getPagination(request.query);
    const branchId = request.query.branchId || request.user.branch?.id;
    if (!branchId) throw new ApiError(422, "Vui lòng chọn chi nhánh");
    const search = String(request.query.search || "").trim();
    const where = {
      branchId,
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
    const branchId = request.query.branchId || request.user.branch?.id;
    const inventories = await prisma.inventory.findMany({
      where: branchId ? { branchId } : {},
      include: { ingredient: true, branch: { select: { id: true, name: true } } },
    });
    const expiringBatches = await prisma.inventoryBatch.findMany({
      where: {
        ...(branchId ? { branchId } : {}),
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
    const where = {
      ...(request.query.branchId ? { branchId: request.query.branchId } : {}),
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
    const adjustment = await prisma.$transaction(async (tx) => {
      const inventory = await tx.inventory.findUnique({
        where: { branchId_ingredientId: { branchId, ingredientId } },
        include: { ingredient: true },
      });
      if (!inventory) throw new ApiError(404, "Không tìm thấy tồn kho nguyên liệu");
      const decrease = ["ADJUST_OUT", "WASTE"].includes(type);
      const delta = type === "STOCKTAKE" ? quantity - inventory.quantity : decrease ? -quantity : quantity;
      if (inventory.quantity + delta < 0) throw new ApiError(422, "Điều chỉnh sẽ làm tồn kho âm");
      const updated = await tx.inventory.update({
        where: { id: inventory.id },
        data: { quantity: inventory.quantity + delta },
      });
      const transaction = await tx.inventoryTransaction.create({
        data: {
          code: createBusinessCode("KHO"),
          type,
          branchId,
          ingredientId,
          quantity: delta,
          balanceAfter: updated.quantity,
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
    const data = await prisma.$transaction(async (tx) => {
      const { fromBranchId, toBranchId, ingredientId, quantity, note } = request.body;
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

