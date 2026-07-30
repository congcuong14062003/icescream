import { ApiError } from "../utils/api-error.js";

export async function validatePromotion(tx, code, context) {
  if (!code) return { promotion: null, discount: 0 };
  const now = new Date();
  const promotion = await tx.promotion.findUnique({
    where: { code: code.trim().toUpperCase() },
    include: {
      products: true,
      categories: true,
      _count: { select: { usages: true } },
    },
  });
  if (!promotion || !promotion.isActive) throw new ApiError(422, "Mã khuyến mãi không tồn tại hoặc đã ngừng");
  if (promotion.startAt > now || promotion.endAt < now) {
    throw new ApiError(422, "Mã khuyến mãi chưa đến hạn hoặc đã hết hạn");
  }
  if (context.originalAmount < promotion.minOrderValue) {
    throw new ApiError(
      422,
      `Đơn hàng tối thiểu để dùng mã là ${promotion.minOrderValue.toLocaleString("vi-VN")}đ`,
    );
  }
  if (promotion.totalUsageLimit && promotion._count.usages >= promotion.totalUsageLimit) {
    throw new ApiError(422, "Mã khuyến mãi đã hết lượt sử dụng");
  }
  if (promotion.memberOnly && !context.customerId) {
    throw new ApiError(422, "Mã khuyến mãi chỉ dành cho khách hàng thành viên");
  }
  if (context.customerId) {
    const customerUsage = await tx.promotionUsage.count({
      where: { promotionId: promotion.id, customerId: context.customerId },
    });
    if (customerUsage >= promotion.usagePerCustomer) {
      throw new ApiError(422, "Khách hàng đã dùng hết lượt cho mã này");
    }
  }
  if (promotion.type === "HAPPY_HOUR") {
    const hour = now.getHours();
    if (
      promotion.startHour === null ||
      promotion.endHour === null ||
      hour < promotion.startHour ||
      hour >= promotion.endHour
    ) {
      throw new ApiError(422, "Mã chỉ áp dụng trong khung giờ vàng");
    }
  }

  let eligibleAmount = context.originalAmount;
  if (promotion.type === "PRODUCT" && promotion.products.length) {
    const ids = new Set(promotion.products.map((item) => item.productId));
    eligibleAmount = context.lines
      .filter((line) => ids.has(line.productId))
      .reduce((sum, line) => sum + line.lineTotal, 0);
  }
  if (promotion.type === "CATEGORY" && promotion.categories.length) {
    const ids = new Set(promotion.categories.map((item) => item.categoryId));
    eligibleAmount = context.lines
      .filter((line) => ids.has(line.categoryId))
      .reduce((sum, line) => sum + line.lineTotal, 0);
  }
  if (eligibleAmount <= 0) throw new ApiError(422, "Giỏ hàng không có sản phẩm phù hợp với mã");

  let discount;
  if (["PERCENT", "PRODUCT", "CATEGORY", "MEMBER"].includes(promotion.type)) {
    discount = Math.round((eligibleAmount * promotion.value) / 100);
  } else {
    discount = promotion.value;
  }
  if (promotion.maxDiscount) discount = Math.min(discount, promotion.maxDiscount);
  discount = Math.min(discount, context.originalAmount);
  return { promotion, discount };
}

