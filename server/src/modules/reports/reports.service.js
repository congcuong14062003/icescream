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

export async function buildReport({ from, to, branchId }) {
  const orderWhere = {
    createdAt: { gte: from, lte: to },
    ...(branchId ? { branchId } : {}),
  };
  const completedWhere = { ...orderWhere, status: "COMPLETED" };
  const duration = to.getTime() - from.getTime() + 1;
  const previousTo = new Date(from.getTime() - 1);
  const previousFrom = new Date(previousTo.getTime() - duration + 1);
  const previousWhere = {
    status: "COMPLETED",
    createdAt: { gte: previousFrom, lte: previousTo },
    ...(branchId ? { branchId } : {}),
  };

  const [
    completedOrders,
    allOrders,
    newCustomers,
    previousOrders,
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
        totalAmount: true,
        taxAmount: true,
        discountAmount: true,
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
    prisma.customer.count({ where: { createdAt: { gte: from, lte: to }, deletedAt: null } }),
    prisma.order.findMany({ where: previousWhere, select: { totalAmount: true } }),
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
      where: branchId ? { branchId } : {},
      include: { ingredient: true, branch: { select: { name: true } } },
    }),
    prisma.inventoryBatch.findMany({
      where: {
        ...(branchId ? { branchId } : {}),
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

  const revenue = completedOrders.reduce((sum, order) => sum + order.totalAmount, 0);
  const refunded = completedOrders.reduce(
    (sum, order) => sum + order.refunds.reduce((refundSum, refund) => refundSum + refund.amount, 0),
    0,
  );
  const netRevenue = revenue - refunded;
  const previousRevenue = previousOrders.reduce((sum, order) => sum + order.totalAmount, 0);
  const estimatedCost = completedOrders.reduce(
    (sum, order) =>
      sum +
      order.items.reduce(
        (itemSum, item) =>
          itemSum +
          (item.variant?.costPrice || 0) * item.quantity +
          item.toppings.reduce(
            (toppingSum, orderTopping) => toppingSum + orderTopping.topping.costPrice * orderTopping.quantity * item.quantity,
            0,
          ),
        0,
      ),
    0,
  );

  const seriesMap = new Map();
  const branchMap = new Map();
  const employeeMap = new Map();
  const paymentMap = new Map();
  for (const order of completedOrders) {
    const date = order.createdAt.toISOString().slice(0, 10);
    const day = seriesMap.get(date) || { date, revenue: 0, orders: 0 };
    day.revenue += order.totalAmount;
    day.orders += 1;
    seriesMap.set(date, day);

    const branch = branchMap.get(order.branchId) || { name: order.branch.name, revenue: 0, orders: 0 };
    branch.revenue += order.totalAmount;
    branch.orders += 1;
    branchMap.set(order.branchId, branch);

    const employee = employeeMap.get(order.createdById) || { name: order.createdBy.fullName, revenue: 0, orders: 0 };
    employee.revenue += order.totalAmount;
    employee.orders += 1;
    employeeMap.set(order.createdById, employee);

    for (const payment of order.payments) {
      paymentMap.set(payment.method, (paymentMap.get(payment.method) || 0) + payment.amount);
    }
  }

  const completedCount = allOrders.filter((item) => item.status === "COMPLETED").length;
  const cancelledCount = allOrders.filter((item) => item.status === "CANCELLED").length;
  return {
    range: { from, to, previousFrom, previousTo },
    summary: {
      revenue: netRevenue,
      grossRevenue: revenue,
      refunds: refunded,
      orders: completedOrders.length,
      averageOrderValue: completedOrders.length ? Math.round(netRevenue / completedOrders.length) : 0,
      newCustomers,
      estimatedCost,
      estimatedProfit: netRevenue - estimatedCost,
      previousRevenue,
      revenueChange:
        previousRevenue > 0 ? Number((((netRevenue - previousRevenue) / previousRevenue) * 100).toFixed(1)) : null,
      completionRate: allOrders.length ? Number(((completedCount / allOrders.length) * 100).toFixed(1)) : 0,
      cancellationRate: allOrders.length ? Number(((cancelledCount / allOrders.length) * 100).toFixed(1)) : 0,
    },
    revenueSeries: [...seriesMap.values()],
    branchRevenue: [...branchMap.values()].sort((a, b) => b.revenue - a.revenue),
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

