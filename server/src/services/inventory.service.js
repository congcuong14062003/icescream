import { ApiError } from "../utils/api-error.js";
import { consumeInventoryBatches } from "./inventory-batch.service.js";

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
  for (const [transactionIndex, [ingredientId, required]] of [...needs.entries()].entries()) {
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
    const batchCost = await consumeInventoryBatches(tx, {
      branchId,
      ingredientId,
      quantity: required,
      ingredientName: ingredient?.name,
    });
    await tx.inventoryTransaction.create({
      data: {
        code: `SALE-${orderId}-${String(transactionIndex + 1).padStart(3, "0")}`,
        type: "SALE",
        branchId,
        ingredientId,
        quantity: -required,
        balanceAfter: updated.quantity,
        unitCost: batchCost.unitCost,
        referenceType: "Order",
        referenceId: orderId,
        note: "Xuất kho tự động khi hoàn thành đơn",
        createdById: userId,
      },
    });

  }
}
