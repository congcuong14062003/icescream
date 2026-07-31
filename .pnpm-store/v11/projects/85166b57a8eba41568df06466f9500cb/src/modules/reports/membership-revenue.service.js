function scopedWhere(branchIds) {
  return branchIds === null ? {} : { branchId: { in: branchIds } };
}

function vietnamDateKey(value) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Ho_Chi_Minh",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(value);
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

function percentChange(current, previous) {
  if (!previous) return null;
  return Number((((current - previous) / Math.abs(previous)) * 100).toFixed(1));
}

function addRevenue(map, key, base, amountPaid) {
  const current = map.get(key) || { ...base, revenue: 0, subscriptions: 0 };
  current.revenue += amountPaid;
  current.subscriptions += 1;
  map.set(key, current);
}

export async function buildMembershipRevenueReport(
  prisma,
  { from, to, branchIds },
) {
  const branchScope = scopedWhere(branchIds);
  const duration = to.getTime() - from.getTime() + 1;
  const previousTo = new Date(from.getTime() - 1);
  const previousFrom = new Date(previousTo.getTime() - duration + 1);
  const select = {
    id: true,
    code: true,
    customerId: true,
    startsAt: true,
    endsAt: true,
    amountPaid: true,
    paymentMethod: true,
    status: true,
    createdAt: true,
    customer: {
      select: { id: true, code: true, fullName: true, phone: true },
    },
    membershipPlan: {
      select: { id: true, code: true, name: true },
    },
    branch: {
      select: { id: true, code: true, name: true },
    },
    createdBy: {
      select: { id: true, fullName: true },
    },
  };

  const [subscriptions, previousSubscriptions, activeSubscriptions] =
    await Promise.all([
      prisma.membershipSubscription.findMany({
        where: {
          createdAt: { gte: from, lte: to },
          ...branchScope,
        },
        select,
        orderBy: { createdAt: "asc" },
      }),
      prisma.membershipSubscription.findMany({
        where: {
          createdAt: { gte: previousFrom, lte: previousTo },
          ...branchScope,
        },
        select: { amountPaid: true },
      }),
      prisma.membershipSubscription.count({
        where: {
          status: "ACTIVE",
          startsAt: { lte: new Date() },
          endsAt: { gt: new Date() },
          ...branchScope,
        },
      }),
    ]);

  const customerIds = [...new Set(subscriptions.map((item) => item.customerId))];
  const priorCustomers = customerIds.length
    ? await prisma.membershipSubscription.findMany({
        where: {
          customerId: { in: customerIds },
          createdAt: { lt: from },
          ...branchScope,
        },
        select: { customerId: true },
        distinct: ["customerId"],
      })
    : [];
  const seenCustomers = new Set(priorCustomers.map((item) => item.customerId));

  const dailyMap = new Map();
  const planMap = new Map();
  const branchMap = new Map();
  const employeeMap = new Map();
  const paymentMap = new Map();
  let revenue = 0;
  let newSubscriptions = 0;
  let renewals = 0;

  for (const subscription of subscriptions) {
    revenue += subscription.amountPaid;
    if (seenCustomers.has(subscription.customerId)) renewals += 1;
    else newSubscriptions += 1;
    seenCustomers.add(subscription.customerId);

    const date = vietnamDateKey(subscription.createdAt);
    addRevenue(dailyMap, date, { date }, subscription.amountPaid);
    addRevenue(
      planMap,
      subscription.membershipPlan.id,
      {
        id: subscription.membershipPlan.id,
        code: subscription.membershipPlan.code,
        name: subscription.membershipPlan.name,
      },
      subscription.amountPaid,
    );
    addRevenue(
      branchMap,
      subscription.branch.id,
      {
        id: subscription.branch.id,
        code: subscription.branch.code,
        name: subscription.branch.name,
      },
      subscription.amountPaid,
    );
    addRevenue(
      employeeMap,
      `${subscription.createdBy.id}:${subscription.branch.id}`,
      {
        id: subscription.createdBy.id,
        name: subscription.createdBy.fullName,
        branchId: subscription.branch.id,
        branchName: subscription.branch.name,
      },
      subscription.amountPaid,
    );
    addRevenue(
      paymentMap,
      subscription.paymentMethod,
      { method: subscription.paymentMethod },
      subscription.amountPaid,
    );
  }

  const previousRevenue = previousSubscriptions.reduce(
    (sum, item) => sum + item.amountPaid,
    0,
  );
  const byRevenue = (left, right) => right.revenue - left.revenue;
  return {
    range: { from, to, previousFrom, previousTo },
    summary: {
      revenue,
      subscriptions: subscriptions.length,
      uniqueCustomers: customerIds.length,
      averageRevenue: subscriptions.length
        ? Math.round(revenue / subscriptions.length)
        : 0,
      activeSubscriptions,
      newSubscriptions,
      renewals,
      previousRevenue,
      previousSubscriptions: previousSubscriptions.length,
      revenueChange: percentChange(revenue, previousRevenue),
      subscriptionChange: percentChange(
        subscriptions.length,
        previousSubscriptions.length,
      ),
    },
    dailySeries: [...dailyMap.values()].sort((left, right) =>
      left.date.localeCompare(right.date),
    ),
    planBreakdown: [...planMap.values()]
      .map((item) => ({
        ...item,
        share: revenue ? Number(((item.revenue / revenue) * 100).toFixed(1)) : 0,
      }))
      .sort(byRevenue),
    branchBreakdown: [...branchMap.values()].sort(byRevenue),
    employeeBreakdown: [...employeeMap.values()].sort(byRevenue),
    paymentBreakdown: [...paymentMap.values()].sort(byRevenue),
    recentSubscriptions: [...subscriptions]
      .reverse()
      .slice(0, 20)
      .map((item) => ({
        id: item.id,
        code: item.code,
        amountPaid: item.amountPaid,
        paymentMethod: item.paymentMethod,
        status: item.status,
        startsAt: item.startsAt,
        endsAt: item.endsAt,
        createdAt: item.createdAt,
        customer: item.customer,
        membershipPlan: item.membershipPlan,
        branch: item.branch,
        createdBy: item.createdBy,
      })),
  };
}
