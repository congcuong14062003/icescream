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
  const { promotion, voucher, discount, benefit } = await validatePromotion(tx, input.promotionCode, {
    originalAmount,
    customerId: input.customerId,
    branchId: input.branchId,
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

  const requestedPoints = input.pointsToRedeem || 0;
  if (requestedPoints > 0) {
    throw new ApiError(
      422,
      "Điểm tích lũy chỉ dùng để thăng hạng và không thể đổi thành tiền",
    );
  }

  let customer = null;
  if (input.customerId) {
    customer = await tx.customer.findFirst({
      where: { id: input.customerId, deletedAt: null },
      include: { membershipLevel: true },
    });
    if (!customer) throw new ApiError(422, "Khách hàng không tồn tại");
  }

  const vatRate = 8;
  const taxable = Math.max(
    0,
    originalAmount - discount - membershipDiscount,
  );
  const taxAmount = Math.round((taxable * vatRate) / 100);
  const deliveryFee = input.deliveryFee || 0;
  const totalAmount = taxable + taxAmount + deliveryFee;

  return {
    lines,
    customer,
    promotion,
    voucher,
    promotionBenefit: benefit,
    activeMembership: membershipPricing.subscription,
    membershipBenefit: membershipPricing.benefit,
    originalAmount,
    discountAmount: promotion ? discount : 0,
    voucherDiscount: voucher ? discount : 0,
    membershipDiscount,
    pointsDiscount: 0,
    pointsToRedeem: 0,
    vatRate,
    taxAmount,
    deliveryFee,
    totalAmount,
  };
}
