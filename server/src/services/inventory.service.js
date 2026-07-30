import { ApiError } from "../utils/api-error.js";
import { createBusinessCode } from "../utils/code.js";

function addNeed(map, ingredientId, quantity) {
  map.set(ingredientId, (map.get(ingredientId) || 0) + quantity);
}

export async function collectRecipeNeeds(tx, lines) {
  const productIds = [...new Set(lines.map((line) => line.productId))];
  const variantIds = [...new Set(lines.map((line) => line.variantId).filter(Boolean))];
  const flavorIds = [...new Set(lines.flatMap((line) => line.flavors.map((flavor) => flavor.id || flavor.flavorId)))];
  const toppingIds = [...new Set(lines.flatMap((line) => line.toppings.map((topping) => topping.id || topping.toppingId)))];
  const recipes = await tx.productRecipe.findMany({
    where: {
      OR: [
        { productId: { in: productIds } },
        { variantId: { in: variantIds } },
        { flavorId: { in: flavorIds } },
        { toppingId: { in: toppingIds } },
      ],
    },
    include: { ingredient: { select: { id: true, name: true, unit: true } } },
  });

  const needs = new Map();
  for (const line of lines) {
    const multiplier = line.quantity;
    for (const recipe of recipes) {
      if (recipe.productId === line.productId || recipe.variantId === line.variantId) {
        addNeed(needs, recipe.ingredientId, recipe.quantity * multiplier);
      }
    }
    for (const flavor of line.flavors) {
      const flavorId = flavor.id || flavor.flavorId;
      for (const recipe of recipes.filter((item) => item.flavorId === flavorId)) {
        addNeed(needs, recipe.ingredientId, recipe.quantity * multiplier);
      }
    }
    for (const topping of line.toppings) {
      const toppingId = topping.id || topping.toppingId;
      const toppingQuantity = topping.quantity || 1;
      for (const recipe of recipes.filter((item) => item.toppingId === toppingId)) {
        addNeed(needs, recipe.ingredientId, recipe.quantity * multiplier * toppingQuantity);
      }
    }
  }
  return { needs, recipes };
}

export async function deductInventory(tx, branchId, lines, userId, orderId) {
  const { needs, recipes } = await collectRecipeNeeds(tx, lines);
  const ingredientInfo = new Map(recipes.map((recipe) => [recipe.ingredientId, recipe.ingredient]));
  for (const [ingredientId, required] of needs.entries()) {
    const inventory = await tx.inventory.findUnique({
      where: { branchId_ingredientId: { branchId, ingredientId } },
    });
    const ingredient = ingredientInfo.get(ingredientId);
    if (!inventory || inventory.quantity < required) {
      throw new ApiError(
        422,
        `Không đủ ${ingredient?.name || "nguyên liệu"}: cần ${required.toLocaleString("vi-VN")} ${ingredient?.unit || ""}`,
      );
    }

    const updated = await tx.inventory.update({
      where: { id: inventory.id },
      data: { quantity: { decrement: required } },
    });
    await tx.inventoryTransaction.create({
      data: {
        code: createBusinessCode("KHO"),
        type: "SALE",
        branchId,
        ingredientId,
        quantity: -required,
        balanceAfter: updated.quantity,
        referenceType: "Order",
        referenceId: orderId,
        note: "Xuất kho tự động khi hoàn thành đơn",
        createdById: userId,
      },
    });

    let remainingToDeduct = required;
    const batches = await tx.inventoryBatch.findMany({
      where: { branchId, ingredientId, remaining: { gt: 0 } },
      orderBy: [{ expiryDate: "asc" }, { createdAt: "asc" }],
    });
    for (const batch of batches) {
      if (remainingToDeduct <= 0) break;
      const amount = Math.min(batch.remaining, remainingToDeduct);
      await tx.inventoryBatch.update({
        where: { id: batch.id },
        data: { remaining: { decrement: amount } },
      });
      remainingToDeduct -= amount;
    }
    if (remainingToDeduct > 0.0001) {
      throw new ApiError(422, `Dữ liệu lô của ${ingredient?.name || "nguyên liệu"} không đủ`);
    }
  }
}

export async function updateCustomerAfterCompletion(tx, order, pricing) {
  if (!order.customerId || !pricing.customer) return;
  const customer = pricing.customer;
  const currentPoints = customer.points;
  const pointsToRedeem = pricing.pointsToRedeem || 0;
  const pointRate = customer.membershipLevel.pointRate;
  const earnedPoints = Math.max(0, Math.floor((order.totalAmount / 10000) * pointRate * 100));
  let balance = currentPoints;

  if (pointsToRedeem > 0) {
    balance -= pointsToRedeem;
    await tx.customerPointTransaction.create({
      data: {
        customerId: customer.id,
        orderId: order.id,
        type: "REDEEM",
        points: -pointsToRedeem,
        balanceAfter: balance,
        description: `Dùng điểm cho đơn ${order.code}`,
      },
    });
  }
  if (earnedPoints > 0) {
    balance += earnedPoints;
    await tx.customerPointTransaction.create({
      data: {
        customerId: customer.id,
        orderId: order.id,
        type: "EARN",
        points: earnedPoints,
        balanceAfter: balance,
        description: `Tích điểm từ đơn ${order.code}`,
      },
    });
  }

  const totalSpending = customer.totalSpending + order.totalAmount;
  const membership = await tx.membershipLevel.findFirst({
    where: { minSpending: { lte: totalSpending } },
    orderBy: { minSpending: "desc" },
  });
  await tx.customer.update({
    where: { id: customer.id },
    data: {
      totalSpending,
      totalOrders: { increment: 1 },
      points: balance,
      membershipLevelId: membership.id,
    },
  });
}

