import { ApiError } from "../utils/api-error.js";

export function benefitDateFor(date = new Date()) {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  })
    .formatToParts(date)
    .reduce((result, item) => {
      if (item.type !== "literal") result[item.type] = item.value;
      return result;
    }, {});
  return new Date(`${parts.year}-${parts.month}-${parts.day}T00:00:00.000Z`);
}

export async function getCurrentMembership(tx, customerId, now = new Date()) {
  if (!customerId) return null;
  return tx.membershipSubscription.findFirst({
    where: {
      customerId,
      status: "ACTIVE",
      startsAt: { lte: now },
      endsAt: { gt: now },
    },
    include: {
      membershipPlan: {
        include: {
          benefitVariant: {
            include: {
              product: {
                select: { id: true, code: true, name: true, imageUrl: true },
              },
            },
          },
          products: {
            include: {
              product: {
                select: { id: true, code: true, name: true, imageUrl: true },
              },
            },
          },
        },
      },
    },
    orderBy: { endsAt: "desc" },
  });
}

export async function calculateMembershipBenefit(tx, customerId, lines, now = new Date()) {
  const subscription = await getCurrentMembership(tx, customerId, now);
  if (!subscription) {
    return { subscription: null, discount: 0, benefit: null };
  }

  const benefitDate = benefitDateFor(now);
  const existingUsage = await tx.membershipBenefitUsage.findUnique({
    where: {
      subscriptionId_benefitDate: {
        subscriptionId: subscription.id,
        benefitDate,
      },
    },
  });
  const eligibleProductIds = new Set(
    subscription.membershipPlan.products.map((item) => item.productId),
  );
  const benefitVariantId = subscription.membershipPlan.benefitVariantId;
  const eligibleLines = lines.filter(
    (line) =>
      (benefitVariantId && line.variantId === benefitVariantId) ||
      (!benefitVariantId &&
        (eligibleProductIds.size === 0 || eligibleProductIds.has(line.productId))),
  );
  const eligibleQuantity = eligibleLines.reduce((sum, line) => sum + line.quantity, 0);

  if (existingUsage) {
    return {
      subscription,
      discount: 0,
      benefit: {
        available: false,
        usedToday: true,
        benefitDate,
        eligibleQuantity,
        freeQuantity: 0,
        dailyFreeQuantity: subscription.membershipPlan.dailyFreeQuantity,
        benefitVariantId,
      },
    };
  }

  const freeQuantity = Math.min(
    subscription.membershipPlan.dailyFreeQuantity,
    eligibleQuantity,
  );
  if (freeQuantity <= 0) {
    return {
      subscription,
      discount: 0,
      benefit: {
        available: false,
        usedToday: false,
        benefitDate,
        eligibleQuantity: 0,
        freeQuantity: 0,
        dailyFreeQuantity: subscription.membershipPlan.dailyFreeQuantity,
        benefitVariantId,
      },
    };
  }

  const units = eligibleLines
    .map((line) => ({
      unitPrice: line.basePrice ?? line.unitPrice,
      quantity: line.quantity,
    }))
    .sort((left, right) => left.unitPrice - right.unitPrice);
  let remaining = freeQuantity;
  let discount = 0;
  for (const unit of units) {
    if (remaining <= 0) break;
    const quantity = Math.min(unit.quantity, remaining);
    discount += unit.unitPrice * quantity;
    remaining -= quantity;
  }

  return {
    subscription,
    discount,
    benefit: {
      available: true,
      usedToday: false,
      benefitDate,
      eligibleQuantity,
      freeQuantity,
      dailyFreeQuantity: subscription.membershipPlan.dailyFreeQuantity,
      benefitVariantId,
    },
  };
}

export async function assertPaidMember(tx, customerId) {
  if (!customerId) {
    throw new ApiError(422, "Ưu đãi này chỉ dành cho hội viên trả phí");
  }
  const membership = await getCurrentMembership(tx, customerId);
  if (!membership) {
    throw new ApiError(422, "Khách hàng chưa có gói hội viên còn hiệu lực");
  }
  return membership;
}

export function publicMembership(subscription, now = new Date()) {
  if (!subscription) return null;
  return {
    id: subscription.id,
    code: subscription.code,
    startsAt: subscription.startsAt,
    endsAt: subscription.endsAt,
    amountPaid: subscription.amountPaid,
    paymentMethod: subscription.paymentMethod,
    status: subscription.status,
    isCurrent:
      subscription.status === "ACTIVE" &&
      subscription.startsAt <= now &&
      subscription.endsAt > now,
    plan: subscription.membershipPlan,
  };
}
