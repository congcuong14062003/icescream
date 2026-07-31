import { prisma } from "../../config/prisma.js";

function startOfDay(date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfDay(date) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
}

function estimatedOrderCost(order) {
  return order.items.reduce(
    (itemSum, item) =>
      itemSum +
      (item.variant?.costPrice || 0) * item.quantity +
      item.toppings.reduce(
        (toppingSum, orderTopping) =>
          toppingSum +
          orderTopping.topping.costPrice *
            orderTopping.quantity *
            item.quantity,
        0,
      ),
    0,
  );
}

function financialMetrics(orders, actualCostByOrder) {
  const byOrder = new Map();
  let salesBeforeDiscount = 0;
  let discounts = 0;
  let grossCollected = 0;
  let taxCollected = 0;
  let deliveryRevenue = 0;
  let refunds = 0;
  let netRevenue = 0;
  let costOfGoods = 0;
  let actualCostOrders = 0;

  for (const order of orders) {
    const refundedAmount = order.refunds.reduce(
      (sum, refund) => sum + refund.amount,
      0,
    );
    const revenueBeforeRefund = Math.max(0, order.totalAmount - order.taxAmount);
    const refundBeforeTax = order.totalAmount > 0
      ? Math.round((refundedAmount * revenueBeforeRefund) / order.totalAmount)
      : 0;
    const orderRevenue = Math.max(0, revenueBeforeRefund - refundBeforeTax);
    const hasActualCost = actualCostByOrder.has(order.id);
    const orderCost = hasActualCost
      ? actualCostByOrder.get(order.id)
      : estimatedOrderCost(order);
    const orderProfit = orderRevenue - orderCost;

    salesBeforeDiscount += order.originalAmount;
    discounts +=
      order.discountAmount +
      order.voucherDiscount +
      order.pointsDiscount +
      order.membershipDiscount;
    grossCollected += order.totalAmount;
    taxCollected += order.taxAmount;
    deliveryRevenue += order.deliveryFee;
    refunds += refundedAmount;
    netRevenue += orderRevenue;
    costOfGoods += orderCost;
    if (hasActualCost) actualCostOrders += 1;
    byOrder.set(order.id, {
      revenue: orderRevenue,
      cost: orderCost,
      profit: orderProfit,
      hasActualCost,
    });
  }

  const grossProfit = netRevenue - costOfGoods;
  return {
    byOrder,
    salesBeforeDiscount,
    discounts,
    grossCollected,
    taxCollected,
    deliveryRevenue,
    refunds,
    netRevenue,
    costOfGoods,
    grossProfit,
    grossMargin: netRevenue > 0
      ? Number(((grossProfit / netRevenue) * 100).toFixed(1))
      : 0,
    actualCostOrders,
    actualCostCoverage: orders.length
      ? Number(((actualCostOrders / orders.length) * 100).toFixed(1))
      : 0,
  };
}

export function reportRange(query) {
  const to = query.to ? endOfDay(new Date(query.to)) : endOfDay(new Date());
  const from = query.from
    ? startOfDay(new Date(query.from))
    : startOfDay(new Date(Date.now() - 6 * 86400000));
  if (Number.isNaN(from.getTime()) || Number.isNaN(to.getTime()) || from > to) {
    throw new Error("Khoảng thời gian không hợp lệ");
  }
  return { from, to };
}

export async function buildReport({ from, to, branchId, branchIds }) {
  const scopedBranchIds =
    branchIds !== undefined
      ? branchIds
      : branchId
        ? [branchId]
        : null;
  const branchWhere =
    scopedBranchIds === null
      ? {}
      : { branchId: { in: scopedBranchIds } };
  const orderWhere = {
    createdAt: { gte: from, lte: to },
    ...branchWhere,
  };
  const completedWhere = { ...orderWhere, status: "COMPLETED" };
  const duration = to.getTime() - from.getTime() + 1;
  const previousTo = new Date(from.getTime() - 1);
  const previousFrom = new Date(previousTo.getTime() - duration + 1);
  const previousWhere = {
    status: "COMPLETED",
    createdAt: { gte: previousFrom, lte: previousTo },
    ...branchWhere,
  };

  const [
    completedOrders,
    allOrders,
    newCustomers,
    previousOrders,
    currentMemberships,
    previousMemberships,
    topProductsRaw,
    topFlavorsRaw,
    topToppingsRaw,
    inventories,
    expiringBatches,
  ] = await Promise.all([
    prisma.order.findMany({
      where: completedWhere,
      select: {
        id: true,
        code: true,
        branchId: true,
        createdById: true,
        originalAmount: true,
        totalAmount: true,
        taxAmount: true,
        discountAmount: true,
        voucherDiscount: true,
        pointsDiscount: true,
        membershipDiscount: true,
        deliveryFee: true,
        createdAt: true,
        branch: { select: { name: true } },
        createdBy: { select: { fullName: true } },
        items: { select: { quantity: true, variant: { select: { costPrice: true } }, toppings: { include: { topping: true } } } },
        payments: { select: { method: true, amount: true } },
        refunds: { where: { status: "COMPLETED" }, select: { amount: true } },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.order.findMany({
      where: orderWhere,
      select: { status: true },
    }),
    prisma.customer.count({
      where: {
        createdAt: { gte: from, lte: to },
        deletedAt: null,
        ...(scopedBranchIds === null
          ? {}
          : { orders: { some: { branchId: { in: scopedBranchIds } } } }),
      },
    }),
    prisma.order.findMany({
      where: previousWhere,
      select: {
        id: true,
        originalAmount: true,
        totalAmount: true,
        taxAmount: true,
        discountAmount: true,
        voucherDiscount: true,
        pointsDiscount: true,
        membershipDiscount: true,
        deliveryFee: true,
        items: {
          select: {
            quantity: true,
            variant: { select: { costPrice: true } },
            toppings: { include: { topping: true } },
          },
        },
        refunds: {
          where: { status: "COMPLETED" },
          select: { amount: true },
        },
      },
    }),
    prisma.membershipSubscription.findMany({
      where: {
        createdAt: { gte: from, lte: to },
        ...branchWhere,
      },
      select: {
        amountPaid: true,
        paymentMethod: true,
        createdAt: true,
        branchId: true,
        createdById: true,
        branch: { select: { name: true } },
        createdBy: { select: { fullName: true } },
      },
    }),
    prisma.membershipSubscription.findMany({
      where: {
        createdAt: { gte: previousFrom, lte: previousTo },
        ...branchWhere,
      },
      select: { amountPaid: true },
    }),
    prisma.orderItem.groupBy({
      by: ["productId", "productName"],
      where: { order: completedWhere },
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 8,
    }),
    prisma.orderItemFlavor.groupBy({
      by: ["flavorId"],
      where: { orderItem: { order: completedWhere } },
      _count: { flavorId: true },
      orderBy: { _count: { flavorId: "desc" } },
      take: 8,
    }),
    prisma.orderItemTopping.groupBy({
      by: ["toppingId"],
      where: { orderItem: { order: completedWhere } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: "desc" } },
      take: 8,
    }),
    prisma.inventory.findMany({
      where: branchWhere,
      include: { ingredient: true, branch: { select: { name: true } } },
    }),
    prisma.inventoryBatch.findMany({
      where: {
        ...branchWhere,
        remaining: { gt: 0 },
        expiryDate: { gte: new Date(), lte: new Date(Date.now() + 14 * 86400000) },
      },
      include: { ingredient: true, branch: { select: { name: true } } },
      orderBy: { expiryDate: "asc" },
      take: 20,
    }),
  ]);

  const flavorDetails = await prisma.flavor.findMany({
    where: { id: { in: topFlavorsRaw.map((item) => item.flavorId) } },
    select: { id: true, name: true, color: true },
  });
  const toppingDetails = await prisma.topping.findMany({
    where: { id: { in: topToppingsRaw.map((item) => item.toppingId) } },
    select: { id: true, name: true },
  });
  const flavorMap = new Map(flavorDetails.map((item) => [item.id, item]));
  const toppingMap = new Map(toppingDetails.map((item) => [item.id, item]));

  const allOrderIds = [...completedOrders, ...previousOrders].map((order) => order.id);
  const saleTransactions = allOrderIds.length
    ? await prisma.inventoryTransaction.findMany({
        where: {
          type: "SALE",
          referenceType: "Order",
          referenceId: { in: allOrderIds },
        },
        select: { referenceId: true, quantity: true, unitCost: true },
      })
    : [];
  const actualCostByOrder = new Map();
  for (const transaction of saleTransactions) {
    const cost = Math.round(Math.abs(transaction.quantity) * transaction.unitCost);
    actualCostByOrder.set(
      transaction.referenceId,
      (actualCostByOrder.get(transaction.referenceId) || 0) + cost,
    );
  }
  const currentFinancials = financialMetrics(completedOrders, actualCostByOrder);
  const previousFinancials = financialMetrics(previousOrders, actualCostByOrder);
  const membershipRevenue = currentMemberships.reduce(
    (sum, item) => sum + item.amountPaid,
    0,
  );
  const previousMembershipRevenue = previousMemberships.reduce(
    (sum, item) => sum + item.amountPaid,
    0,
  );
  const currentNetRevenue = currentFinancials.netRevenue + membershipRevenue;
  const previousNetRevenue =
    previousFinancials.netRevenue + previousMembershipRevenue;
  const currentGrossProfit = currentFinancials.grossProfit + membershipRevenue;
  const previousGrossProfit =
    previousFinancials.grossProfit + previousMembershipRevenue;
  const profitChange = previousGrossProfit !== 0
    ? Number(
        (
          ((currentGrossProfit - previousGrossProfit) /
            Math.abs(previousGrossProfit)) *
          100
        ).toFixed(1),
      )
    : null;
  const revenueChange = previousNetRevenue > 0
    ? Number(
        (
          ((currentNetRevenue - previousNetRevenue) /
            previousNetRevenue) *
          100
        ).toFixed(1),
      )
    : null;

  const financials = {
    salesBeforeDiscount: currentFinancials.salesBeforeDiscount,
    discounts: currentFinancials.discounts,
    grossCollected: currentFinancials.grossCollected + membershipRevenue,
    taxCollected: currentFinancials.taxCollected,
    deliveryRevenue: currentFinancials.deliveryRevenue,
    refunds: currentFinancials.refunds,
    membershipRevenue,
    netRevenue: currentNetRevenue,
    costOfGoods: currentFinancials.costOfGoods,
    grossProfit: currentGrossProfit,
    grossMargin: currentNetRevenue > 0
      ? Number(((currentGrossProfit / currentNetRevenue) * 100).toFixed(1))
      : 0,
    actualCostOrders: currentFinancials.actualCostOrders,
    actualCostCoverage: currentFinancials.actualCostCoverage,
    previousNetRevenue,
    previousGrossProfit,
    revenueChange,
    profitChange,
  };

  const refunded = currentFinancials.refunds;
  const netRevenue = currentNetRevenue;
  const previousRevenue = previousNetRevenue;
  const estimatedCost = currentFinancials.costOfGoods;

  const seriesMap = new Map();
  const branchMap = new Map();
  const employeeMap = new Map();
  const paymentMap = new Map();
  for (const order of completedOrders) {
    const orderFinancials = currentFinancials.byOrder.get(order.id);
    const date = order.createdAt.toISOString().slice(0, 10);
    const day = seriesMap.get(date) || {
      date,
      revenue: 0,
      cost: 0,
      profit: 0,
      orders: 0,
    };
    day.revenue += orderFinancials.revenue;
    day.cost += orderFinancials.cost;
    day.profit += orderFinancials.profit;
    day.orders += 1;
    seriesMap.set(date, day);

    const branch = branchMap.get(order.branchId) || {
      name: order.branch.name,
      revenue: 0,
      cost: 0,
      profit: 0,
      orders: 0,
    };
    branch.revenue += orderFinancials.revenue;
    branch.cost += orderFinancials.cost;
    branch.profit += orderFinancials.profit;
    branch.orders += 1;
    branchMap.set(order.branchId, branch);

    const employee = employeeMap.get(order.createdById) || {
      name: order.createdBy.fullName,
      revenue: 0,
      orders: 0,
    };
    employee.revenue += orderFinancials.revenue;
    employee.orders += 1;
    employeeMap.set(order.createdById, employee);

    for (const payment of order.payments) {
      paymentMap.set(payment.method, (paymentMap.get(payment.method) || 0) + payment.amount);
    }
  }
  for (const membership of currentMemberships) {
    const date = membership.createdAt.toISOString().slice(0, 10);
    const day = seriesMap.get(date) || {
      date,
      revenue: 0,
      cost: 0,
      profit: 0,
      orders: 0,
    };
    day.revenue += membership.amountPaid;
    day.profit += membership.amountPaid;
    day.memberships = (day.memberships || 0) + 1;
    seriesMap.set(date, day);

    const branch = branchMap.get(membership.branchId) || {
      name: membership.branch.name,
      revenue: 0,
      cost: 0,
      profit: 0,
      orders: 0,
    };
    branch.revenue += membership.amountPaid;
    branch.profit += membership.amountPaid;
    branch.memberships = (branch.memberships || 0) + 1;
    branchMap.set(membership.branchId, branch);

    const employee = employeeMap.get(membership.createdById) || {
      name: membership.createdBy.fullName,
      revenue: 0,
      orders: 0,
    };
    employee.revenue += membership.amountPaid;
    employee.memberships = (employee.memberships || 0) + 1;
    employeeMap.set(membership.createdById, employee);
    paymentMap.set(
      membership.paymentMethod,
      (paymentMap.get(membership.paymentMethod) || 0) + membership.amountPaid,
    );
  }

  const revenueSeries = [...seriesMap.values()].map((item) => ({
    ...item,
    margin: item.revenue > 0
      ? Number(((item.profit / item.revenue) * 100).toFixed(1))
      : 0,
  }));
  const branchProfitability = [...branchMap.values()]
    .map((item) => ({
      ...item,
      margin: item.revenue > 0
        ? Number(((item.profit / item.revenue) * 100).toFixed(1))
        : 0,
    }))
    .sort((left, right) => right.profit - left.profit);

  const completedCount = allOrders.filter((item) => item.status === "COMPLETED").length;
  const cancelledCount = allOrders.filter((item) => item.status === "CANCELLED").length;
  return {
    range: { from, to, previousFrom, previousTo },
    financials,
    summary: {
      revenue: netRevenue,
      grossRevenue: currentFinancials.grossCollected + membershipRevenue,
      membershipRevenue,
      refunds: refunded,
      orders: completedOrders.length,
      averageOrderValue: completedOrders.length
        ? Math.round(currentFinancials.netRevenue / completedOrders.length)
        : 0,
      newCustomers,
      estimatedCost,
      estimatedProfit: netRevenue - estimatedCost,
      previousRevenue,
      revenueChange,
      completionRate: allOrders.length ? Number(((completedCount / allOrders.length) * 100).toFixed(1)) : 0,
      cancellationRate: allOrders.length ? Number(((cancelledCount / allOrders.length) * 100).toFixed(1)) : 0,
    },
    revenueSeries,
    branchRevenue: branchProfitability.map(({ name, revenue, orders }) => ({
      name,
      revenue,
      orders,
    })),
    branchProfitability,
    employeeRevenue: [...employeeMap.values()].sort((a, b) => b.revenue - a.revenue),
    paymentRevenue: [...paymentMap.entries()].map(([method, amount]) => ({ method, amount })),
    topProducts: topProductsRaw.map((item) => ({
      id: item.productId,
      name: item.productName,
      quantity: item._sum.quantity || 0,
      revenue: item._sum.lineTotal || 0,
    })),
    topFlavors: topFlavorsRaw.map((item) => ({
      ...flavorMap.get(item.flavorId),
      count: item._count.flavorId,
    })),
    topToppings: topToppingsRaw.map((item) => ({
      ...toppingMap.get(item.toppingId),
      count: item._sum.quantity || 0,
    })),
    lowStock: inventories
      .filter((item) => item.quantity <= item.ingredient.minStock)
      .sort((a, b) => a.quantity - b.quantity)
      .slice(0, 20),
    expiringBatches,
  };
}
