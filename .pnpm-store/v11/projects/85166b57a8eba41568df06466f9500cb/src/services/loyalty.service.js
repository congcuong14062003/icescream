import { ApiError } from "../utils/api-error.js";
import { createBusinessCode } from "../utils/code.js";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function publicVoucher(voucher, now = new Date()) {
  if (!voucher) return null;
  const runtimeStatus =
    voucher.status === "ACTIVE" && voucher.expiresAt <= now
      ? "EXPIRED"
      : voucher.status;
  return {
    ...voucher,
    status: runtimeStatus,
    isUsable: runtimeStatus === "ACTIVE",
  };
}

async function expireOldVouchers(tx, customerId, now) {
  await tx.customerVoucher.updateMany({
    where: {
      customerId,
      status: "ACTIVE",
      expiresAt: { lte: now },
    },
    data: { status: "EXPIRED" },
  });
}

async function issueVoucher(tx, customer, level, order, issueReason, now) {
  if (!level.voucherEnabled || level.voucherValue <= 0) return null;
  const expiresAt = new Date(
    now.getTime() + level.voucherValidityDays * DAY_IN_MS,
  );
  return tx.customerVoucher.create({
    data: {
      code: createBusinessCode("VC"),
      customerId: customer.id,
      membershipLevelId: level.id,
      branchId: order.branchId,
      createdById: order.createdById,
      issuedFromOrderId: order.id,
      type: level.voucherType,
      value: level.voucherValue,
      maxDiscount: level.voucherMaxDiscount,
      minOrderValue: level.voucherMinOrderValue,
      issueReason,
      expiresAt,
    },
  });
}

async function canIssueVoucher(tx, customerId, level, branchId, now) {
  const activeVoucher = await tx.customerVoucher.findFirst({
    where: {
      customerId,
      branchId,
      status: "ACTIVE",
      expiresAt: { gt: now },
    },
    select: { id: true },
  });
  if (activeVoucher) return false;

  const latestUsedVoucher = await tx.customerVoucher.findFirst({
    where: {
      customerId,
      branchId,
      status: "USED",
      usedAt: { not: null },
    },
    orderBy: { usedAt: "desc" },
  });
  if (!latestUsedVoucher?.usedAt) return true;
  const nextEligibleAt = new Date(
    latestUsedVoucher.usedAt.getTime() +
      level.voucherCooldownDays * DAY_IN_MS,
  );
  return nextEligibleAt <= now;
}

async function maybeIssueRenewalVoucher(tx, customer, level, order, now) {
  if (
    !level.voucherEnabled ||
    level.voucherValue <= 0 ||
    order.totalAmount < level.voucherRenewalOrderMinAmount
  ) {
    return null;
  }
  if (!(await canIssueVoucher(tx, customer.id, level, order.branchId, now))) {
    return null;
  }

  return issueVoucher(tx, customer, level, order, "QUALIFYING_ORDER", now);
}

export async function consumeCustomerVoucher(
  tx,
  voucher,
  orderId,
  branchId,
  now = new Date(),
) {
  if (!voucher) return null;
  const result = await tx.customerVoucher.updateMany({
    where: {
      id: voucher.id,
      customerId: voucher.customerId,
      branchId,
      status: "ACTIVE",
      usedAt: null,
      expiresAt: { gt: now },
    },
    data: {
      status: "USED",
      usedAt: now,
      usedOrderId: orderId,
    },
  });
  if (result.count !== 1) {
    throw new ApiError(
      409,
      "Voucher vừa được sử dụng hoặc đã hết hạn; vui lòng tính lại đơn hàng",
    );
  }
}

export async function updateCustomerAfterCompletion(tx, order) {
  if (!order.customerId) return null;
  const now = new Date();
  const customer = await tx.customer.findUnique({
    where: { id: order.customerId },
    include: { membershipLevel: true },
  });
  if (!customer) return null;

  const earnedPoints = Math.max(
    0,
    Math.floor((order.totalAmount / 10000) * customer.membershipLevel.pointRate),
  );
  const balance = customer.points + earnedPoints;
  if (earnedPoints > 0) {
    await tx.customerPointTransaction.create({
      data: {
        customerId: customer.id,
        orderId: order.id,
        type: "EARN",
        points: earnedPoints,
        balanceAfter: balance,
        description: `Tích điểm xét hạng từ đơn ${order.code}`,
      },
    });
  }

  const candidateLevel = await tx.membershipLevel.findFirst({
    where: { minPoints: { lte: balance } },
    orderBy: [{ minPoints: "desc" }, { displayOrder: "desc" }],
  });
  if (!candidateLevel) {
    throw new ApiError(500, "Hệ thống chưa cấu hình hạng khách hàng");
  }
  const level =
    candidateLevel.displayOrder >= customer.membershipLevel.displayOrder
      ? candidateLevel
      : customer.membershipLevel;

  const upgraded =
    level.id !== customer.membershipLevelId &&
    (level.minPoints > customer.membershipLevel.minPoints ||
      level.displayOrder > customer.membershipLevel.displayOrder);

  await tx.customer.update({
    where: { id: customer.id },
    data: {
      totalSpending: { increment: order.totalAmount },
      totalOrders: { increment: 1 },
      points: balance,
      membershipLevelId: level.id,
    },
  });

  await expireOldVouchers(tx, customer.id, now);
  const voucher =
    upgraded &&
    (await canIssueVoucher(tx, customer.id, level, order.branchId, now))
      ? await issueVoucher(tx, customer, level, order, "TIER_UPGRADE", now)
      : await maybeIssueRenewalVoucher(tx, customer, level, order, now);

  return {
    earnedPoints,
    balance,
    upgraded,
    level,
    voucher,
  };
}
