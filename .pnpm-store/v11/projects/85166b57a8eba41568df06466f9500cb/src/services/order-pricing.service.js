import { ApiError } from "../utils/api-error.js";
import { validatePromotion } from "./promotion.service.js";
import { calculateMembershipBenefit } from "./membership.service.js";

export async function calculateOrder(tx, input) {
  if (!input.items?.length) throw new ApiError(422, "Giỏ hàng đang trống");

  const variantIds = [...new Set(input.items.map((item) => item.variantId))];
  const flavorIds = [...new Set(input.items.flatMap((item) => item.flavorIds || []))];
  const toppingIds = [...new Set(input.items.flatMap((item) => item.toppingIds || []))];

  const [variants, flavors, toppings] = await Promise.all([
    tx.productVariant.findMany({
      where: { id: { in: variantIds } },
      include: { product: { include: { category: true } } },
    }),
    tx.flavor.findMany({ where: { id: { in: flavorIds } } }),
    tx.topping.findMany({ where: { id: { in: toppingIds } } }),
  ]);

  const variantMap = new Map(variants.map((item) => [item.id, item]));
  const flavorMap = new Map(flavors.map((item) => [item.id, item]));
  const toppingMap = new Map(toppings.map((item) => [item.id, item]));
  const lines = [];

  for (const inputLine of input.items) {
    const variant = variantMap.get(inputLine.variantId);
    if (!variant || !variant.isActive || variant.product.deletedAt || variant.product.status !== "ACTIVE") {
      throw new ApiError(422, "Một sản phẩm trong giỏ đã ngừng bán hoặc không tồn tại");
    }

    const selectedFlavors = (inputLine.flavorIds || []).map((id) => {
      const flavor = flavorMap.get(id);
      if (!flavor || flavor.deletedAt || flavor.status !== "AVAILABLE") {
        throw new ApiError(422, `Hương vị đã hết hàng hoặc ngừng bán`);
      }
      return flavor;
    });
    if (variant.scoopCount > 0 && selectedFlavors.length !== variant.scoopCount) {
      throw new ApiError(
        422,
        `${variant.product.name} - ${variant.name} cần chọn đúng ${variant.scoopCount} hương vị`,
      );
    }

    const selectedToppings = (inputLine.toppingIds || []).map((id) => {
      const topping = toppingMap.get(id);
      if (!topping || topping.deletedAt || topping.stockStatus !== "AVAILABLE") {
        throw new ApiError(422, "Một topping đã hết hàng hoặc ngừng bán");
      }
      return topping;
    });

    const extras =
      selectedFlavors.reduce((sum, flavor) => sum + flavor.extraPrice, 0) +
      selectedToppings.reduce((sum, topping) => sum + topping.price, 0);
    const unitPrice = variant.price + extras;
    const lineTotal = unitPrice * inputLine.quantity;
    lines.push({
      productId: variant.productId,
      categoryId: variant.product.categoryId,
      variantId: variant.id,
      productName: variant.product.name,
      variantName: variant.name,
      sku: variant.sku,
      basePrice: variant.price,
      unitPrice,
      quantity: inputLine.quantity,
      scoopCount: variant.scoopCount,
      lineTotal,
      note: inputLine.note || null,
      flavors: selectedFlavors,
      toppings: selectedToppings,
    });
  }

  const originalAmount = lines.reduce((sum, line) => sum + line.lineTotal, 0);
  const { promotion, discount, benefit } = await validatePromotion(tx, input.promotionCode, {
    originalAmount,
    customerId: input.customerId,
    lines,
  });
  const membershipPricing = await calculateMembershipBenefit(
    tx,
    input.customerId,
    lines,
  );
  const membershipDiscount = Math.min(
    membershipPricing.discount,
    Math.max(0, originalAmount - discount),
  );

  let customer = null;
  let pointsDiscount = 0;
  let appliedPoints = 0;
  let maxRedeemablePoints = 0;
  let maxPointsDiscount = 0;
  const requestedPoints = input.pointsToRedeem || 0;
  if (input.customerId) {
    customer = await tx.customer.findFirst({
      where: { id: input.customerId, deletedAt: null },
      include: { membershipLevel: true },
    });
    if (!customer) throw new ApiError(422, "Khách hàng không tồn tại");
    if (requestedPoints > customer.points) {
      throw new ApiError(422, "Số điểm sử dụng vượt quá điểm hiện có");
    }
    const amountBeforePoints = Math.max(
      0,
      originalAmount - discount - membershipDiscount,
    );
    maxPointsDiscount = Math.floor(amountBeforePoints * 0.2);
    maxRedeemablePoints = Math.min(
      customer.points,
      Math.floor(maxPointsDiscount / customer.membershipLevel.pointValue),
    );
    appliedPoints = Math.min(requestedPoints, maxRedeemablePoints);
    pointsDiscount = appliedPoints * customer.membershipLevel.pointValue;
  } else if (requestedPoints > 0) {
    throw new ApiError(422, "Vui lòng chọn khách hàng trước khi sử dụng điểm");
  }

  const vatRate = 8;
  const taxable = Math.max(
    0,
    originalAmount - discount - membershipDiscount - pointsDiscount,
  );
  const taxAmount = Math.round((taxable * vatRate) / 100);
  const deliveryFee = input.deliveryFee || 0;
  const totalAmount = taxable + taxAmount + deliveryFee;

  return {
    lines,
    customer,
    promotion,
    promotionBenefit: benefit,
    activeMembership: membershipPricing.subscription,
    membershipBenefit: membershipPricing.benefit,
    originalAmount,
    discountAmount: discount,
    membershipDiscount,
    pointsDiscount,
    pointsToRedeem: appliedPoints,
    maxRedeemablePoints,
    maxPointsDiscount,
    vatRate,
    taxAmount,
    deliveryFee,
    totalAmount,
  };
}
