import { ApiError } from "../utils/api-error.js";

const precision = 1000;

export function normalizeStockQuantity(value) {
  return Math.round(Number(value) * precision) / precision;
}

export async function consumeInventoryBatches(
  tx,
  { branchId, ingredientId, quantity, ingredientName },
) {
  const requested = normalizeStockQuantity(quantity);
  const batches = await tx.inventoryBatch.findMany({
    where: { branchId, ingredientId, remaining: { gt: 0 } },
    orderBy: { createdAt: "asc" },
  });

  batches.sort((left, right) => {
    if (!left.expiryDate && !right.expiryDate) {
      return left.createdAt.getTime() - right.createdAt.getTime();
    }
    if (!left.expiryDate) return 1;
    if (!right.expiryDate) return -1;
    return left.expiryDate.getTime() - right.expiryDate.getTime();
  });

  const available = normalizeStockQuantity(
    batches.reduce((sum, batch) => sum + batch.remaining, 0),
  );
  if (available + 0.0001 < requested) {
    throw new ApiError(
      422,
      `Dữ liệu lô của ${ingredientName || "nguyên liệu"} không đủ: cần ${requested.toLocaleString("vi-VN")}, còn ${available.toLocaleString("vi-VN")}`,
    );
  }

  let remainingToDeduct = requested;
  let totalCost = 0;
  for (const batch of batches) {
    if (remainingToDeduct <= 0.0001) break;
    const amount = normalizeStockQuantity(
      Math.min(batch.remaining, remainingToDeduct),
    );
    await tx.inventoryBatch.update({
      where: { id: batch.id },
      data: { remaining: { decrement: amount } },
    });
    totalCost += amount * batch.unitCost;
    remainingToDeduct = normalizeStockQuantity(remainingToDeduct - amount);
  }

  const roundedTotalCost = Math.round(totalCost);
  return {
    totalCost: roundedTotalCost,
    unitCost: requested > 0 ? Math.round(roundedTotalCost / requested) : 0,
  };
}

export async function createAdjustmentBatch(
  tx,
  {
    branchId,
    ingredientId,
    quantity,
    unitCost,
    batchNumber,
  },
) {
  const normalizedQuantity = normalizeStockQuantity(quantity);
  if (normalizedQuantity <= 0) return null;
  return tx.inventoryBatch.create({
    data: {
      branchId,
      ingredientId,
      batchNumber,
      quantity: normalizedQuantity,
      remaining: normalizedQuantity,
      unitCost: Math.max(0, Math.round(unitCost || 0)),
    },
  });
}
