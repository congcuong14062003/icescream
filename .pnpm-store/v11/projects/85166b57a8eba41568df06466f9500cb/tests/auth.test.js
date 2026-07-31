import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../src/app.js";
import { prisma } from "../src/config/prisma.js";
import { updateCustomerAfterCompletion } from "../src/services/loyalty.service.js";

test("health endpoint uses the unified response shape", async () => {
  const response = await request(app).get("/api/health").expect(200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.database, "MySQL");
});

test("protected endpoint rejects unauthenticated users", async () => {
  const response = await request(app).get("/api/products").expect(401);
  assert.equal(response.body.success, false);
});

test("demo cashier can log in without exposing password hash", async () => {
  const response = await request(app)
    .post("/api/auth/login")
    .send({ login: "cashier", password: "IceCream@123" })
    .expect(200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.user.role.code, "CASHIER");
  assert.equal(response.body.data.user.passwordHash, undefined);
  assert.ok(response.body.data.accessToken);
});

test("cashier can quote and complete a real POS order", async () => {
  const login = await request(app)
    .post("/api/auth/login")
    .send({ login: "cashier", password: "IceCream@123" })
    .expect(200);
  const authorization = `Bearer ${login.body.data.accessToken}`;
  const [products, flavors, toppings] = await Promise.all([
    request(app).get("/api/products?status=ACTIVE&size=1").set("Authorization", authorization).expect(200),
    request(app).get("/api/flavors?status=AVAILABLE&size=100").set("Authorization", authorization).expect(200),
    request(app).get("/api/toppings?status=AVAILABLE&size=1").set("Authorization", authorization).expect(200),
  ]);
  const variant = products.body.data[0].variants.find((item) => item.isActive);
  const flavorId = flavors.body.data[0].id;
  const input = {
    items: [
      {
        variantId: variant.id,
        quantity: 1,
        flavorIds: Array.from({ length: variant.scoopCount }, () => flavorId),
        toppingIds: [toppings.body.data[0].id],
      },
    ],
    pointsToRedeem: 0,
    deliveryFee: 0,
  };
  const quote = await request(app)
    .post("/api/orders/quote")
    .set("Authorization", authorization)
    .send(input)
    .expect(200);
  const total = quote.body.data.totalAmount;
  const checkout = await request(app)
    .post("/api/orders")
    .set("Authorization", authorization)
    .send({
      ...input,
      saveAsDraft: false,
      customerPaid: total,
      payments: [{ method: "CASH", amount: total }],
    })
    .expect(201);
  assert.equal(checkout.body.data.status, "COMPLETED");
  assert.equal(checkout.body.data.totalAmount, total);
  assert.ok(checkout.body.data.payments.length);
});

test("warehouse role is blocked from POS by backend permission", async () => {
  const login = await request(app)
    .post("/api/auth/login")
    .send({ login: "warehouse", password: "IceCream@123" })
    .expect(200);
  const response = await request(app)
    .post("/api/orders/quote")
    .set("Authorization", `Bearer ${login.body.data.accessToken}`)
    .send({ items: [] })
    .expect(403);
  assert.equal(response.body.success, false);
});

test("warehouse staff can issue stock and complete a stocktake only at their branch", async () => {
  const login = await request(app)
    .post("/api/auth/login")
    .send({ login: "warehouse", password: "IceCream@123" })
    .expect(200);
  const authorization = `Bearer ${login.body.data.accessToken}`;
  const ownBranchId = login.body.data.user.branch.id;

  const inventoryResponse = await request(app)
    .get(`/api/inventory?branchId=${ownBranchId}&size=100`)
    .set("Authorization", authorization)
    .expect(200);
  const inventoryLine = inventoryResponse.body.data.find((item) => item.quantity >= 2);
  assert.ok(inventoryLine);

  const otherBranch = await prisma.branch.findFirst({
    where: { id: { not: ownBranchId }, deletedAt: null },
    select: { id: true },
  });
  assert.ok(otherBranch);
  await request(app)
    .post("/api/inventory/issues")
    .set("Authorization", authorization)
    .send({
      branchId: otherBranch.id,
      reason: "INTERNAL_USE",
      note: "Không được xuất khác chi nhánh",
      items: [{ ingredientId: inventoryLine.ingredientId, quantity: 1 }],
    })
    .expect(403);

  const issue = await request(app)
    .post("/api/inventory/issues")
    .set("Authorization", authorization)
    .send({
      branchId: ownBranchId,
      reason: "INTERNAL_USE",
      note: "Xuất dùng nội bộ để kiểm thử",
      items: [{ ingredientId: inventoryLine.ingredientId, quantity: 1 }],
    })
    .expect(201);
  assert.match(issue.body.data.code, /^PXK/);
  assert.equal(issue.body.data.items.length, 1);
  assert.equal(issue.body.data.items[0].quantity, 1);
  assert.ok(issue.body.data.totalCost >= 0);

  const afterIssue = await request(app)
    .get(`/api/inventory?branchId=${ownBranchId}&search=${encodeURIComponent(inventoryLine.ingredient.code)}&size=100`)
    .set("Authorization", authorization)
    .expect(200);
  const issuedInventory = afterIssue.body.data.find(
    (item) => item.ingredientId === inventoryLine.ingredientId,
  );
  assert.equal(issuedInventory.quantity, inventoryLine.quantity - 1);

  const countedQuantity = issuedInventory.quantity + 0.5;
  const stocktake = await request(app)
    .post("/api/inventory/stocktakes")
    .set("Authorization", authorization)
    .send({
      branchId: ownBranchId,
      note: "Kiểm kho API tự động",
      items: [{
        ingredientId: inventoryLine.ingredientId,
        actualQuantity: countedQuantity,
      }],
    })
    .expect(201);
  assert.match(stocktake.body.data.code, /^KK/);
  assert.equal(stocktake.body.data.items[0].systemQuantity, issuedInventory.quantity);
  assert.equal(stocktake.body.data.items[0].actualQuantity, countedQuantity);
  assert.equal(stocktake.body.data.items[0].difference, 0.5);

  const [issues, stocktakes] = await Promise.all([
    request(app)
      .get(`/api/inventory/issues?branchId=${ownBranchId}&size=5`)
      .set("Authorization", authorization)
      .expect(200),
    request(app)
      .get(`/api/inventory/stocktakes?branchId=${ownBranchId}&size=5`)
      .set("Authorization", authorization)
      .expect(200),
  ]);
  assert.ok(issues.body.data.some((item) => item.id === issue.body.data.id));
  assert.ok(stocktakes.body.data.some((item) => item.id === stocktake.body.data.id));
});

test("buy three get one promotion makes the cheapest eligible unit free", async () => {
  const login = await request(app)
    .post("/api/auth/login")
    .send({ login: "cashier", password: "IceCream@123" })
    .expect(200);
  const authorization = `Bearer ${login.body.data.accessToken}`;
  const [products, flavors] = await Promise.all([
    request(app)
      .get("/api/products?status=ACTIVE&size=10")
      .set("Authorization", authorization)
      .expect(200),
    request(app)
      .get("/api/flavors?status=AVAILABLE&size=100")
      .set("Authorization", authorization)
      .expect(200),
  ]);
  const product = products.body.data.find((item) =>
    item.variants.some((variant) => variant.isActive),
  );
  const variant = product.variants.find((item) => item.isActive);
  const flavor = flavors.body.data[0];
  const flavorIds = Array.from({ length: variant.scoopCount }, () => flavor.id);
  const unitPrice = variant.price + flavor.extraPrice * variant.scoopCount;
  const baseInput = {
    promotionCode: "MUA3TANG1",
    pointsToRedeem: 0,
    deliveryFee: 0,
  };

  const insufficient = await request(app)
    .post("/api/orders/quote")
    .set("Authorization", authorization)
    .send({
      ...baseInput,
      items: [{ variantId: variant.id, quantity: 3, flavorIds, toppingIds: [] }],
    })
    .expect(422);
  assert.match(insufficient.body.message, /ít nhất 4 sản phẩm/);

  const quote = await request(app)
    .post("/api/orders/quote")
    .set("Authorization", authorization)
    .send({
      ...baseInput,
      items: [{ variantId: variant.id, quantity: 4, flavorIds, toppingIds: [] }],
    })
    .expect(200);
  assert.equal(quote.body.data.promotion.code, "MUA3TANG1");
  assert.equal(quote.body.data.promotion.type, "BUY_X_GET_Y");
  assert.equal(quote.body.data.promotion.benefit.freeQuantity, 1);
  assert.equal(quote.body.data.originalAmount, unitPrice * 4);
  assert.equal(quote.body.data.discountAmount, unitPrice);
});

test("manager can configure an offer and POS immediately follows its active status", async () => {
  const [managerLogin, cashierLogin] = await Promise.all([
    request(app)
      .post("/api/auth/login")
      .send({ login: "manager", password: "IceCream@123" })
      .expect(200),
    request(app)
      .post("/api/auth/login")
      .send({ login: "cashier", password: "IceCream@123" })
      .expect(200),
  ]);
  const managerAuthorization = `Bearer ${managerLogin.body.data.accessToken}`;
  const cashierAuthorization = `Bearer ${cashierLogin.body.data.accessToken}`;
  const code = `TEST${Date.now().toString().slice(-8)}`;
  const input = {
    code,
    name: "Ưu đãi cấu hình tự động",
    description: "Dữ liệu kiểm thử màn hình quản lý ưu đãi",
    type: "BUY_X_GET_Y",
    value: 0,
    startAt: new Date(Date.now() - 86400000).toISOString(),
    endAt: new Date(Date.now() + 30 * 86400000).toISOString(),
    minOrderValue: 0,
    maxDiscount: null,
    totalUsageLimit: 100,
    usagePerCustomer: 5,
    buyQuantity: 3,
    getQuantity: 1,
    startHour: null,
    endHour: null,
    memberOnly: false,
    isActive: true,
    productIds: [],
    categoryIds: [],
  };

  const forbidden = await request(app)
    .post("/api/promotions")
    .set("Authorization", cashierAuthorization)
    .send(input)
    .expect(403);
  assert.equal(forbidden.body.success, false);

  let promotionId;
  try {
    const createdPromotion = await request(app)
      .post("/api/promotions")
      .set("Authorization", managerAuthorization)
      .send(input)
      .expect(201);
    promotionId = createdPromotion.body.data.id;
    assert.equal(createdPromotion.body.data.runtimeStatus, "ACTIVE");
    assert.equal(createdPromotion.body.data.buyQuantity, 3);

    const updatedPromotion = await request(app)
      .put(`/api/promotions/${promotionId}`)
      .set("Authorization", managerAuthorization)
      .send({
        ...input,
        name: "Mua 2 tặng 1 cấu hình",
        buyQuantity: 2,
      })
      .expect(200);
    assert.equal(updatedPromotion.body.data.name, "Mua 2 tặng 1 cấu hình");
    assert.equal(updatedPromotion.body.data.buyQuantity, 2);

    const disabledPromotion = await request(app)
      .patch(`/api/promotions/${promotionId}/status`)
      .set("Authorization", managerAuthorization)
      .send({ isActive: false })
      .expect(200);
    assert.equal(disabledPromotion.body.data.runtimeStatus, "INACTIVE");

    const activePromotions = await request(app)
      .get("/api/promotions?active=true&size=100")
      .set("Authorization", cashierAuthorization)
      .expect(200);
    assert.equal(
      activePromotions.body.data.some((item) => item.id === promotionId),
      false,
    );
  } finally {
    if (promotionId) {
      await request(app)
        .delete(`/api/promotions/${promotionId}`)
        .set("Authorization", managerAuthorization);
    }
  }
});

test("only managers receive revenue and profit details from dashboard API", async () => {
  const [managerLogin, warehouseLogin] = await Promise.all([
    request(app)
      .post("/api/auth/login")
      .send({ login: "manager", password: "IceCream@123" })
      .expect(200),
    request(app)
      .post("/api/auth/login")
      .send({ login: "warehouse", password: "IceCream@123" })
      .expect(200),
  ]);
  const [managerReport, warehouseReport] = await Promise.all([
    request(app)
      .get("/api/reports/dashboard")
      .set("Authorization", `Bearer ${managerLogin.body.data.accessToken}`)
      .expect(200),
    request(app)
      .get("/api/reports/dashboard")
      .set("Authorization", `Bearer ${warehouseLogin.body.data.accessToken}`)
      .expect(200),
  ]);

  assert.equal(typeof managerReport.body.data.financials.netRevenue, "number");
  assert.equal(typeof managerReport.body.data.financials.costOfGoods, "number");
  assert.equal(typeof managerReport.body.data.financials.grossProfit, "number");
  assert.equal(typeof managerReport.body.data.financials.grossMargin, "number");
  assert.ok(Array.isArray(managerReport.body.data.branchProfitability));
  assert.equal(warehouseReport.body.data.financials, undefined);
  assert.equal(warehouseReport.body.data.branchProfitability, undefined);
  assert.equal(warehouseReport.body.data.summary.estimatedProfit, undefined);
  assert.equal(warehouseReport.body.data.revenueSeries[0]?.profit, undefined);
});

test("manager can enroll a paid member and POS quotes the daily free item", async () => {
  const [managerLogin, cashierLogin] = await Promise.all([
    request(app)
      .post("/api/auth/login")
      .send({ login: "manager", password: "IceCream@123" })
      .expect(200),
    request(app)
      .post("/api/auth/login")
      .send({ login: "cashier", password: "IceCream@123" })
      .expect(200),
  ]);
  const managerAuthorization = `Bearer ${managerLogin.body.data.accessToken}`;
  const cashierAuthorization = `Bearer ${cashierLogin.body.data.accessToken}`;
  const suffix = Date.now().toString().slice(-8);
  let customerId;
  let subscriptionId;

  try {
    const plans = await request(app)
      .get("/api/memberships/plans?active=true")
      .set("Authorization", managerAuthorization)
      .expect(200);
    const plan = plans.body.data[0];
    assert.ok(plan);
    assert.equal(plan.dailyFreeQuantity, 1);
    assert.ok(plan.benefitVariant);

    const customer = await request(app)
      .post("/api/customers")
      .set("Authorization", managerAuthorization)
      .send({
        fullName: "Khách kiểm thử hội viên",
        phone: `098${suffix}`,
        email: `member-${suffix}@example.vn`,
        address: "Khách kiểm thử tự động",
      })
      .expect(201);
    customerId = customer.body.data.id;

    const enrollment = await request(app)
      .post("/api/memberships/subscriptions")
      .set("Authorization", managerAuthorization)
      .send({
        customerId,
        membershipPlanId: plan.id,
        paymentMethod: "CASH",
        note: "Đăng ký từ API test",
      })
      .expect(201);
    subscriptionId = enrollment.body.data.id;
    assert.equal(enrollment.body.data.amountPaid, plan.price);

    const giftVariant = plan.benefitVariant;
    const [products, flavors] = await Promise.all([
      request(app)
        .get(`/api/products/${giftVariant.product.id}`)
        .set("Authorization", cashierAuthorization)
        .expect(200),
      request(app)
        .get("/api/flavors?status=AVAILABLE&size=100")
        .set("Authorization", cashierAuthorization)
        .expect(200),
    ]);
    const variant = products.body.data.variants.find(
      (item) => item.id === giftVariant.id,
    );
    const flavor = flavors.body.data.find((item) => item.extraPrice === 0);
    const catalog = await request(app)
      .get("/api/products?status=ACTIVE&size=100")
      .set("Authorization", cashierAuthorization)
      .expect(200);
    const paidProduct = catalog.body.data.find(
      (item) =>
        item.id !== giftVariant.product.id &&
        item.variants.some((candidate) => candidate.isActive),
    );
    const paidVariant = paidProduct.variants.find((candidate) => candidate.isActive);
    const paidOnlyQuote = await request(app)
      .post("/api/orders/quote")
      .set("Authorization", cashierAuthorization)
      .send({
        items: [{
          variantId: paidVariant.id,
          quantity: 1,
          flavorIds: Array.from(
            { length: paidVariant.scoopCount },
            () => flavor.id,
          ),
          toppingIds: [],
        }],
        customerId,
        pointsToRedeem: 0,
        deliveryFee: 0,
      })
      .expect(200);
    assert.equal(paidOnlyQuote.body.data.membershipDiscount, 0);
    assert.equal(paidOnlyQuote.body.data.membershipBenefit.available, false);

    const quote = await request(app)
      .post("/api/orders/quote")
      .set("Authorization", cashierAuthorization)
      .send({
        items: [{
          variantId: variant.id,
          quantity: 1,
          flavorIds: Array.from({ length: variant.scoopCount }, () => flavor.id),
          toppingIds: [],
        }],
        customerId,
        pointsToRedeem: 0,
        deliveryFee: 0,
      })
      .expect(200);
    assert.equal(quote.body.data.activeMembership.plan.code, plan.code);
    assert.equal(quote.body.data.membershipBenefit.available, true);
    assert.equal(quote.body.data.membershipBenefit.freeQuantity, 1);
    assert.equal(quote.body.data.membershipDiscount, variant.price);
    assert.equal(quote.body.data.totalAmount, 0);

    const twoGiftItems = await request(app)
      .post("/api/orders/quote")
      .set("Authorization", cashierAuthorization)
      .send({
        items: [{
          variantId: variant.id,
          quantity: 2,
          flavorIds: Array.from({ length: variant.scoopCount }, () => flavor.id),
          toppingIds: [],
        }],
        customerId,
        pointsToRedeem: 0,
        deliveryFee: 0,
      })
      .expect(200);
    assert.equal(twoGiftItems.body.data.membershipDiscount, variant.price);
    assert.equal(twoGiftItems.body.data.membershipBenefit.freeQuantity, 1);
  } finally {
    if (subscriptionId) {
      await prisma.membershipSubscription.delete({ where: { id: subscriptionId } });
    }
    if (customerId) {
      await prisma.customer.delete({ where: { id: customerId } });
    }
  }
});

test("loyalty points cannot be redeemed and tier settings are manager-only", async () => {
  const login = await request(app)
    .post("/api/auth/login")
    .send({ login: "cashier", password: "IceCream@123" })
    .expect(200);
  const authorization = `Bearer ${login.body.data.accessToken}`;
  const [customers, products, flavors] = await Promise.all([
    request(app)
      .get("/api/customers?size=100")
      .set("Authorization", authorization)
      .expect(200),
    request(app)
      .get("/api/products?status=ACTIVE&size=100")
      .set("Authorization", authorization)
      .expect(200),
    request(app)
      .get("/api/flavors?status=AVAILABLE&size=100")
      .set("Authorization", authorization)
      .expect(200),
  ]);
  const customer = customers.body.data
    .filter((item) => !item.activeMembership && item.points > 0)
    .sort((left, right) => right.points - left.points)[0];
  const product = products.body.data.find((item) =>
    item.variants.some((variant) => variant.isActive && variant.price >= 29000),
  );
  const variant = product.variants.find((item) => item.isActive);
  const flavor = flavors.body.data.find((item) => item.extraPrice === 0);
  const response = await request(app)
    .post("/api/orders/quote")
    .set("Authorization", authorization)
    .send({
      items: [{
        variantId: variant.id,
        quantity: 3,
        flavorIds: Array.from({ length: variant.scoopCount }, () => flavor.id),
        toppingIds: [],
      }],
      customerId: customer.id,
      pointsToRedeem: customer.points,
      deliveryFee: 0,
    })
    .expect(422);
  assert.match(response.body.message, /chỉ dùng để thăng hạng/i);

  const levels = await request(app)
    .get("/api/memberships/levels")
    .set("Authorization", authorization)
    .expect(200);
  assert.ok(levels.body.data.length >= 4);
  const level = levels.body.data[0];
  await request(app)
    .put(`/api/memberships/levels/${level.id}`)
    .set("Authorization", authorization)
    .send({
      minPoints: level.minPoints,
      pointRate: level.pointRate,
      voucherEnabled: level.voucherEnabled,
      voucherType: level.voucherType,
      voucherValue: level.voucherValue,
      voucherMaxDiscount: level.voucherMaxDiscount,
      voucherMinOrderValue: level.voucherMinOrderValue,
      voucherValidityDays: level.voucherValidityDays,
      voucherCooldownDays: level.voucherCooldownDays,
      voucherRenewalOrderMinAmount: level.voucherRenewalOrderMinAmount,
    })
    .expect(403);

  const managerLogin = await request(app)
    .post("/api/auth/login")
    .send({ login: "manager", password: "IceCream@123" })
    .expect(200);
  await request(app)
    .put(`/api/memberships/levels/${level.id}`)
    .set("Authorization", `Bearer ${managerLogin.body.data.accessToken}`)
    .send({
      minPoints: level.minPoints,
      pointRate: level.pointRate,
      voucherEnabled: level.voucherEnabled,
      voucherType: level.voucherType,
      voucherValue: level.voucherValue,
      voucherMaxDiscount: level.voucherMaxDiscount,
      voucherMinOrderValue: level.voucherMinOrderValue,
      voucherValidityDays: level.voucherValidityDays,
      voucherCooldownDays: level.voucherCooldownDays,
      voucherRenewalOrderMinAmount: level.voucherRenewalOrderMinAmount,
    })
    .expect(200);
});

test("tier upgrade issues a voucher and using it does not issue another during cooldown", async () => {
  const cashierLogin = await request(app)
    .post("/api/auth/login")
    .send({ login: "cashier", password: "IceCream@123" })
    .expect(200);
  const authorization = `Bearer ${cashierLogin.body.data.accessToken}`;
  const [products, flavors, levels] = await Promise.all([
    request(app)
      .get("/api/products?status=ACTIVE&size=100")
      .set("Authorization", authorization)
      .expect(200),
    request(app)
      .get("/api/flavors?status=AVAILABLE&size=100")
      .set("Authorization", authorization)
      .expect(200),
    request(app)
      .get("/api/memberships/levels")
      .set("Authorization", authorization)
      .expect(200),
  ]);
  const silver = levels.body.data.find((level) => level.code === "SILVER");
  assert.ok(silver?.voucherEnabled);
  const product = products.body.data.find((item) =>
    item.variants.some((variant) => variant.isActive && variant.price >= 20000),
  );
  const variant = product.variants.find((item) => item.isActive);
  const flavor = flavors.body.data.find((item) => item.extraPrice === 0);
  const phone = `098${String(Date.now()).slice(-7)}`;
  const createdCustomer = await request(app)
    .post("/api/customers")
    .set("Authorization", authorization)
    .send({ fullName: "Khách kiểm thử voucher", phone })
    .expect(201);
  const customerId = createdCustomer.body.data.id;
  const items = [{
    variantId: variant.id,
    quantity: 1,
    flavorIds: Array.from({ length: variant.scoopCount }, () => flavor.id),
    toppingIds: [],
  }];

  const initialQuote = await request(app)
    .post("/api/orders/quote")
    .set("Authorization", authorization)
    .send({ items, customerId, deliveryFee: 0 })
    .expect(200);
  const earnedPoints = Math.floor(
    (initialQuote.body.data.totalAmount / 10000) *
      createdCustomer.body.data.membershipLevel.pointRate,
  );
  await prisma.customer.update({
    where: { id: customerId },
    data: { points: Math.max(0, silver.minPoints - earnedPoints) },
  });

  const firstOrder = await request(app)
    .post("/api/orders")
    .set("Authorization", authorization)
    .send({
      items,
      customerId,
      deliveryFee: 0,
      saveAsDraft: false,
      customerPaid: initialQuote.body.data.totalAmount,
      payments: [{
        method: "CASH",
        amount: initialQuote.body.data.totalAmount,
      }],
    })
    .expect(201);
  const voucher = firstOrder.body.data.issuedVouchers.find(
    (item) => item.membershipLevel.code === "SILVER",
  );
  assert.ok(voucher);
  assert.equal(voucher.issueReason, "TIER_UPGRADE");

  const voucherQuote = await request(app)
    .post("/api/orders/quote")
    .set("Authorization", authorization)
    .send({
      items,
      customerId,
      promotionCode: voucher.code,
      deliveryFee: 0,
    })
    .expect(200);
  assert.equal(voucherQuote.body.data.voucher.code, voucher.code);
  assert.ok(voucherQuote.body.data.voucherDiscount > 0);
  const voucherTotal = voucherQuote.body.data.totalAmount;
  await request(app)
    .post("/api/orders")
    .set("Authorization", authorization)
    .send({
      items,
      customerId,
      promotionCode: voucher.code,
      deliveryFee: 0,
      saveAsDraft: false,
      customerPaid: voucherTotal,
      payments:
        voucherTotal > 0
          ? [{ method: "CASH", amount: voucherTotal }]
          : [],
    })
    .expect(201);

  const detail = await request(app)
    .get(`/api/customers/${customerId}`)
    .set("Authorization", authorization)
    .expect(200);
  assert.equal(
    detail.body.data.vouchers.filter((item) => item.status === "USED").length,
    1,
  );
  assert.equal(detail.body.data.activeVouchers.length, 0);

  await prisma.customerVoucher.update({
    where: { id: voucher.id },
    data: { usedAt: new Date(Date.now() - 16 * 86400000) },
  });
  const orderBase = {
    branchId: firstOrder.body.data.branchId,
    customerId,
    createdById: firstOrder.body.data.createdById,
    shiftId: firstOrder.body.data.shiftId,
    originalAmount: 0,
    discountAmount: 0,
    voucherDiscount: 0,
    pointsDiscount: 0,
    membershipDiscount: 0,
    vatRate: 0,
    taxAmount: 0,
    deliveryFee: 0,
    customerPaid: 0,
    changeAmount: 0,
    paymentStatus: "PAID",
    status: "COMPLETED",
    completedAt: new Date(),
  };
  const belowThreshold = await prisma.order.create({
    data: {
      ...orderBase,
      code: `TEST-LOW-${Date.now()}`,
      totalAmount: silver.voucherRenewalOrderMinAmount - 1,
    },
  });
  await prisma.$transaction((tx) =>
    updateCustomerAfterCompletion(tx, belowThreshold),
  );
  assert.equal(
    await prisma.customerVoucher.count({
      where: { customerId, status: "ACTIVE" },
    }),
    0,
  );

  const qualifyingOrder = await prisma.order.create({
    data: {
      ...orderBase,
      code: `TEST-OK-${Date.now()}`,
      totalAmount: silver.voucherRenewalOrderMinAmount,
    },
  });
  await prisma.$transaction((tx) =>
    updateCustomerAfterCompletion(tx, qualifyingOrder),
  );
  const renewalVoucher = await prisma.customerVoucher.findFirst({
    where: { customerId, status: "ACTIVE" },
    orderBy: { createdAt: "desc" },
  });
  assert.ok(renewalVoucher);
  assert.equal(renewalVoucher.issueReason, "QUALIFYING_ORDER");
});

test("admin can issue vouchers for many branches while manager is limited to managed branches", async () => {
  const [adminLogin, managerLogin, cashierLogin] = await Promise.all([
    request(app)
      .post("/api/auth/login")
      .send({ login: "admin", password: "IceCream@123" })
      .expect(200),
    request(app)
      .post("/api/auth/login")
      .send({ login: "manager", password: "IceCream@123" })
      .expect(200),
    request(app)
      .post("/api/auth/login")
      .send({ login: "cashier", password: "IceCream@123" })
      .expect(200),
  ]);
  const adminAuthorization = `Bearer ${adminLogin.body.data.accessToken}`;
  const managerAuthorization = `Bearer ${managerLogin.body.data.accessToken}`;
  const cashierAuthorization = `Bearer ${cashierLogin.body.data.accessToken}`;
  const [branchesResponse, customersResponse, productsResponse, flavorsResponse] =
    await Promise.all([
      request(app)
        .get("/api/branches")
        .set("Authorization", adminAuthorization)
        .expect(200),
      request(app)
        .get("/api/customers?size=100")
        .set("Authorization", adminAuthorization)
        .expect(200),
      request(app)
        .get("/api/products?status=ACTIVE&size=100")
        .set("Authorization", cashierAuthorization)
        .expect(200),
      request(app)
        .get("/api/flavors?status=AVAILABLE&size=100")
        .set("Authorization", cashierAuthorization)
        .expect(200),
    ]);
  const branches = branchesResponse.body.data.filter((branch) => branch.isActive);
  assert.ok(branches.length >= 2);
  const ownBranchId = managerLogin.body.data.user.branch.id;
  const otherBranch = branches.find((branch) => branch.id !== ownBranchId);
  const customer = customersResponse.body.data.find(
    (item) => !item.activeMembership,
  );
  assert.ok(otherBranch);
  assert.ok(customer);

  const createdVoucherIds = [];
  try {
    const adminBatch = await request(app)
      .post("/api/memberships/vouchers")
      .set("Authorization", adminAuthorization)
      .send({
        customerId: customer.id,
        branchIds: branches.slice(0, 2).map((branch) => branch.id),
        type: "FIXED_AMOUNT",
        value: 10000,
        maxDiscount: null,
        minOrderValue: 0,
        validityDays: 15,
      })
      .expect(201);
    assert.equal(adminBatch.body.data.length, 2);
    createdVoucherIds.push(...adminBatch.body.data.map((voucher) => voucher.id));
    assert.deepEqual(
      new Set(adminBatch.body.data.map((voucher) => voucher.branchId)),
      new Set(branches.slice(0, 2).map((branch) => branch.id)),
    );

    await request(app)
      .post("/api/memberships/vouchers")
      .set("Authorization", managerAuthorization)
      .send({
        customerId: customer.id,
        branchIds: [otherBranch.id],
        type: "PERCENT",
        value: 10,
        maxDiscount: 20000,
        minOrderValue: 0,
        validityDays: 10,
      })
      .expect(403);

    const managerVoucher = await request(app)
      .post("/api/memberships/vouchers")
      .set("Authorization", managerAuthorization)
      .send({
        customerId: customer.id,
        branchIds: [ownBranchId],
        type: "PERCENT",
        value: 10,
        maxDiscount: 20000,
        minOrderValue: 0,
        validityDays: 10,
      })
      .expect(201);
    assert.equal(managerVoucher.body.data.length, 1);
    assert.equal(managerVoucher.body.data[0].branchId, ownBranchId);
    createdVoucherIds.push(managerVoucher.body.data[0].id);

    const managerList = await request(app)
      .get("/api/memberships/vouchers?size=100")
      .set("Authorization", managerAuthorization)
      .expect(200);
    assert.ok(
      managerList.body.data.every((voucher) => voucher.branchId === ownBranchId),
    );

    const product = productsResponse.body.data.find((item) =>
      item.variants.some((variant) => variant.isActive),
    );
    const variant = product.variants.find((item) => item.isActive);
    const flavor = flavorsResponse.body.data.find((item) => item.extraPrice === 0);
    const items = [{
      variantId: variant.id,
      quantity: 1,
      flavorIds: Array.from({ length: variant.scoopCount }, () => flavor.id),
      toppingIds: [],
    }];
    const wrongBranchVoucher = adminBatch.body.data.find(
      (voucher) => voucher.branchId !== cashierLogin.body.data.user.branch.id,
    );
    await request(app)
      .post("/api/orders/quote")
      .set("Authorization", cashierAuthorization)
      .send({
        items,
        customerId: customer.id,
        promotionCode: wrongBranchVoucher.code,
        deliveryFee: 0,
      })
      .expect(422);

    const ownBranchVoucher = adminBatch.body.data.find(
      (voucher) => voucher.branchId === cashierLogin.body.data.user.branch.id,
    );
    const validQuote = await request(app)
      .post("/api/orders/quote")
      .set("Authorization", cashierAuthorization)
      .send({
        items,
        customerId: customer.id,
        promotionCode: ownBranchVoucher.code,
        deliveryFee: 0,
      })
      .expect(200);
    assert.equal(validQuote.body.data.voucher.branchId, ownBranchId);
    assert.equal(validQuote.body.data.voucher.branch.id, ownBranchId);
  } finally {
    if (createdVoucherIds.length) {
      await prisma.customerVoucher.deleteMany({
        where: { id: { in: createdVoucherIds } },
      });
    }
  }
});

test("paid membership filter separates active members from other customers", async () => {
  const login = await request(app)
    .post("/api/auth/login")
    .send({ login: "manager", password: "IceCream@123" })
    .expect(200);
  const authorization = `Bearer ${login.body.data.accessToken}`;

  const [active, inactive] = await Promise.all([
    request(app)
      .get("/api/customers?paidMembership=ACTIVE&size=100")
      .set("Authorization", authorization)
      .expect(200),
    request(app)
      .get("/api/customers?paidMembership=INACTIVE&size=100")
      .set("Authorization", authorization)
      .expect(200),
  ]);

  assert.ok(active.body.data.every((customer) => customer.activeMembership));
  assert.ok(inactive.body.data.every((customer) => !customer.activeMembership));
});

test("manager employee and financial access is limited to managed branches", async () => {
  const [adminLogin, managerLogin] = await Promise.all([
    request(app)
      .post("/api/auth/login")
      .send({ login: "admin", password: "IceCream@123" })
      .expect(200),
    request(app)
      .post("/api/auth/login")
      .send({ login: "manager", password: "IceCream@123" })
      .expect(200),
  ]);
  const adminAuthorization = `Bearer ${adminLogin.body.data.accessToken}`;
  const managerAuthorization = `Bearer ${managerLogin.body.data.accessToken}`;
  const ownBranchId = managerLogin.body.data.user.branch.id;

  const [branches, managerMeta, managerUsers, adminUsers] = await Promise.all([
    request(app)
      .get("/api/branches")
      .set("Authorization", adminAuthorization)
      .expect(200),
    request(app)
      .get("/api/users/meta")
      .set("Authorization", managerAuthorization)
      .expect(200),
    request(app)
      .get("/api/users?size=100")
      .set("Authorization", managerAuthorization)
      .expect(200),
    request(app)
      .get("/api/users?size=100")
      .set("Authorization", adminAuthorization)
      .expect(200),
  ]);
  const otherBranch = branches.body.data.find((branch) => branch.id !== ownBranchId);
  assert.ok(otherBranch);
  assert.equal(managerMeta.body.data.canUpdateBranch, false);
  assert.ok(managerMeta.body.data.roles.every((role) => role.code !== "ADMIN"));
  assert.ok(
    managerUsers.body.data.every(
      (employee) =>
        employee.branch?.id === ownBranchId &&
        employee.role.code !== "ADMIN",
    ),
  );
  assert.ok(adminUsers.body.data.some((employee) => employee.role.code === "ADMIN"));

  await request(app)
    .get(`/api/users?branchId=${otherBranch.id}`)
    .set("Authorization", managerAuthorization)
    .expect(403);
  await request(app)
    .get(`/api/reports/dashboard?branchId=${otherBranch.id}`)
    .set("Authorization", managerAuthorization)
    .expect(403);
});

test("unpaid prepared order can be paid from order detail and then completed", async () => {
  const login = await request(app)
    .post("/api/auth/login")
    .send({ login: "cashier", password: "IceCream@123" })
    .expect(200);
  const authorization = `Bearer ${login.body.data.accessToken}`;
  const [products, flavors] = await Promise.all([
    request(app).get("/api/products?status=ACTIVE&size=10").set("Authorization", authorization).expect(200),
    request(app).get("/api/flavors?status=AVAILABLE&size=100").set("Authorization", authorization).expect(200),
  ]);
  const product = products.body.data.find((item) => item.variants.some((variant) => variant.isActive));
  const variant = product.variants.find((item) => item.isActive);
  const flavorIds = Array.from({ length: variant.scoopCount }, () => flavors.body.data[0].id);
  const draft = await request(app)
    .post("/api/orders")
    .set("Authorization", authorization)
    .send({
      items: [{ variantId: variant.id, quantity: 1, flavorIds, toppingIds: [] }],
      saveAsDraft: true,
      customerPaid: 0,
      payments: [],
      deliveryFee: 0,
    })
    .expect(201);
  const orderId = draft.body.data.id;

  for (const status of ["PENDING", "MAKING", "READY"]) {
    await request(app)
      .patch(`/api/orders/${orderId}/status`)
      .set("Authorization", authorization)
      .send({ status })
      .expect(200);
  }
  await request(app)
    .patch(`/api/orders/${orderId}/status`)
    .set("Authorization", authorization)
    .send({ status: "COMPLETED" })
    .expect(422);

  await request(app)
    .post(`/api/payments/order/${orderId}`)
    .set("Authorization", authorization)
    .send({ method: "CASH", amount: draft.body.data.totalAmount })
    .expect(201);
  const paidOrder = await request(app)
    .get(`/api/orders/${orderId}`)
    .set("Authorization", authorization)
    .expect(200);
  assert.equal(paidOrder.body.data.paymentStatus, "PAID");
  assert.ok(paidOrder.body.data.paymentStatusHistory.some((item) => item.status === "UNPAID"));
  assert.ok(paidOrder.body.data.paymentStatusHistory.some((item) => item.status === "PAID"));

  const completed = await request(app)
    .patch(`/api/orders/${orderId}/status`)
    .set("Authorization", authorization)
    .send({ status: "COMPLETED" })
    .expect(200);
  assert.equal(completed.body.data.status, "COMPLETED");
});

test("product detail exposes fixed and selectable ingredient recipes", async () => {
  const login = await request(app)
    .post("/api/auth/login")
    .send({ login: "cashier", password: "IceCream@123" })
    .expect(200);
  const authorization = `Bearer ${login.body.data.accessToken}`;
  const products = await request(app)
    .get("/api/products?status=ACTIVE&size=10")
    .set("Authorization", authorization)
    .expect(200);
  const product = products.body.data.find((item) => item.variants.length > 0);
  const detail = await request(app)
    .get(`/api/products/${product.id}`)
    .set("Authorization", authorization)
    .expect(200);

  assert.ok(Array.isArray(detail.body.data.recipes));
  assert.ok(detail.body.data.variants.every((variant) => Array.isArray(variant.recipes)));
  assert.ok(detail.body.data.variants.some((variant) => variant.recipes.length > 0));
  assert.ok(detail.body.data.flavorRecipes.some((flavor) => flavor.recipes.length > 0));
  assert.ok(detail.body.data.toppingRecipes.some((topping) => topping.recipes.length > 0));
});

test("manager can update product recipes while cashier is forbidden", async () => {
  const [managerLogin, cashierLogin] = await Promise.all([
    request(app).post("/api/auth/login").send({ login: "manager", password: "IceCream@123" }).expect(200),
    request(app).post("/api/auth/login").send({ login: "cashier", password: "IceCream@123" }).expect(200),
  ]);
  const managerAuthorization = `Bearer ${managerLogin.body.data.accessToken}`;
  const cashierAuthorization = `Bearer ${cashierLogin.body.data.accessToken}`;
  const products = await request(app)
    .get("/api/products?status=ACTIVE&size=10")
    .set("Authorization", managerAuthorization)
    .expect(200);
  const product = products.body.data.find((item) => item.variants.length > 0);
  const detail = await request(app)
    .get(`/api/products/${product.id}`)
    .set("Authorization", managerAuthorization)
    .expect(200);
  const originalPayload = {
    productRecipes: detail.body.data.recipes.map(({ ingredientId, quantity, note }) => ({ ingredientId, quantity, note })),
    variants: detail.body.data.variants.map((variant) => ({
      variantId: variant.id,
      recipes: variant.recipes.map(({ ingredientId, quantity, note }) => ({ ingredientId, quantity, note })),
    })),
    flavorRecipes: detail.body.data.flavorRecipes.map((flavor) => ({
      flavorId: flavor.id,
      recipes: flavor.recipes.map(({ ingredientId, quantity, note }) => ({ ingredientId, quantity, note })),
    })),
    toppingRecipes: detail.body.data.toppingRecipes.map((topping) => ({
      toppingId: topping.id,
      recipes: topping.recipes.map(({ ingredientId, quantity, note }) => ({ ingredientId, quantity, note })),
    })),
  };
  const modifiedPayload = structuredClone(originalPayload);
  const targetVariant = modifiedPayload.variants.find((variant) => variant.recipes.length > 0);
  const targetFlavor = modifiedPayload.flavorRecipes.find((flavor) => flavor.recipes.length > 0);
  const targetTopping = modifiedPayload.toppingRecipes.find((topping) => topping.recipes.length > 0);
  assert.ok(targetVariant);
  assert.ok(targetFlavor);
  assert.ok(targetTopping);
  targetVariant.recipes[0].note = "Kiểm thử cập nhật công thức";
  targetFlavor.recipes[0].quantity = Number(targetFlavor.recipes[0].quantity) + 0.125;
  targetFlavor.recipes[0].note = "Kiểm thử định lượng hương vị";
  targetTopping.recipes[0].quantity = Number(targetTopping.recipes[0].quantity) + 0.25;
  targetTopping.recipes[0].note = "Kiểm thử định lượng topping";

  await request(app)
    .get("/api/products/recipes/meta")
    .set("Authorization", managerAuthorization)
    .expect(200);
  await request(app)
    .get("/api/products/recipes/meta")
    .set("Authorization", cashierAuthorization)
    .expect(403);
  await request(app)
    .put(`/api/products/${product.id}/recipes`)
    .set("Authorization", cashierAuthorization)
    .send(modifiedPayload)
    .expect(403);

  try {
    await request(app)
      .put(`/api/products/${product.id}/recipes`)
      .set("Authorization", managerAuthorization)
      .send(modifiedPayload)
      .expect(200);
    const updated = await request(app)
      .get(`/api/products/${product.id}`)
      .set("Authorization", managerAuthorization)
      .expect(200);
    const updatedVariant = updated.body.data.variants.find((variant) => variant.id === targetVariant.variantId);
    const updatedFlavor = updated.body.data.flavorRecipes.find((flavor) => flavor.id === targetFlavor.flavorId);
    const updatedTopping = updated.body.data.toppingRecipes.find((topping) => topping.id === targetTopping.toppingId);
    assert.equal(updatedVariant.recipes[0].note, "Kiểm thử cập nhật công thức");
    assert.equal(updatedFlavor.recipes[0].quantity, targetFlavor.recipes[0].quantity);
    assert.equal(updatedFlavor.recipes[0].note, "Kiểm thử định lượng hương vị");
    assert.equal(updatedTopping.recipes[0].quantity, targetTopping.recipes[0].quantity);
    assert.equal(updatedTopping.recipes[0].note, "Kiểm thử định lượng topping");
    const audit = await prisma.auditLog.findFirst({
      where: { action: "PRODUCT_RECIPE_UPDATE", entityId: product.id },
      orderBy: { createdAt: "desc" },
    });
    assert.ok(audit);
  } finally {
    await request(app)
      .put(`/api/products/${product.id}/recipes`)
      .set("Authorization", managerAuthorization)
      .send(originalPayload)
      .expect(200);
  }
});

test("branch data scope protects inventory, purchase orders and orders", async () => {
  const [adminLogin, managerLogin, warehouseLogin, cashierLogin] = await Promise.all([
    request(app).post("/api/auth/login").send({ login: "admin", password: "IceCream@123" }).expect(200),
    request(app).post("/api/auth/login").send({ login: "manager", password: "IceCream@123" }).expect(200),
    request(app).post("/api/auth/login").send({ login: "warehouse", password: "IceCream@123" }).expect(200),
    request(app).post("/api/auth/login").send({ login: "cashier", password: "IceCream@123" }).expect(200),
  ]);
  const adminAuthorization = `Bearer ${adminLogin.body.data.accessToken}`;
  const managerAuthorization = `Bearer ${managerLogin.body.data.accessToken}`;
  const warehouseAuthorization = `Bearer ${warehouseLogin.body.data.accessToken}`;
  const cashierAuthorization = `Bearer ${cashierLogin.body.data.accessToken}`;
  const ownBranchId = managerLogin.body.data.user.branch.id;

  const [adminBranches, managerBranches, warehouseBranches] = await Promise.all([
    request(app).get("/api/branches").set("Authorization", adminAuthorization).expect(200),
    request(app).get("/api/branches").set("Authorization", managerAuthorization).expect(200),
    request(app).get("/api/branches").set("Authorization", warehouseAuthorization).expect(200),
  ]);
  const otherBranch = adminBranches.body.data.find((branch) => branch.id !== ownBranchId);
  assert.ok(otherBranch);
  assert.ok(managerBranches.body.data.length >= 1);
  assert.ok(managerBranches.body.data.every((branch) => branch.id === ownBranchId));
  assert.deepEqual(
    warehouseBranches.body.data.map((branch) => branch.id),
    [warehouseLogin.body.data.user.branch.id],
  );

  const [adminInventory, managerInventory, warehouseInventory] = await Promise.all([
    request(app).get("/api/inventory?size=100").set("Authorization", adminAuthorization).expect(200),
    request(app).get("/api/inventory?size=100").set("Authorization", managerAuthorization).expect(200),
    request(app).get("/api/inventory?size=100").set("Authorization", warehouseAuthorization).expect(200),
  ]);
  assert.ok(new Set(adminInventory.body.data.map((item) => item.branchId)).size >= 2);
  assert.ok(managerInventory.body.data.every((item) => item.branchId === ownBranchId));
  assert.ok(
    warehouseInventory.body.data.every(
      (item) => item.branchId === warehouseLogin.body.data.user.branch.id,
    ),
  );
  await request(app)
    .get(`/api/inventory?branchId=${otherBranch.id}`)
    .set("Authorization", managerAuthorization)
    .expect(403);
  await request(app)
    .get(`/api/inventory/transactions?branchId=${otherBranch.id}`)
    .set("Authorization", warehouseAuthorization)
    .expect(403);

  const [suppliers, ingredients] = await Promise.all([
    request(app).get("/api/suppliers?size=1").set("Authorization", adminAuthorization).expect(200),
    request(app).get("/api/inventory/ingredients").set("Authorization", adminAuthorization).expect(200),
  ]);
  const purchaseInput = {
    supplierId: suppliers.body.data[0].id,
    branchId: otherBranch.id,
    note: "Phiếu kiểm thử phạm vi chi nhánh",
    items: [{
      ingredientId: ingredients.body.data[0].id,
      quantity: 1,
      unitCost: ingredients.body.data[0].averageCost,
      batchNumber: `TEST-SCOPE-${Date.now()}`,
      manufactureDate: null,
      expiryDate: null,
    }],
  };
  let purchaseOrderId;
  try {
    const createdPurchaseOrder = await request(app)
      .post("/api/purchase-orders")
      .set("Authorization", adminAuthorization)
      .send(purchaseInput)
      .expect(201);
    purchaseOrderId = createdPurchaseOrder.body.data.id;

    await request(app)
      .post("/api/purchase-orders")
      .set("Authorization", managerAuthorization)
      .send(purchaseInput)
      .expect(403);
    await request(app)
      .get(`/api/purchase-orders?branchId=${otherBranch.id}`)
      .set("Authorization", managerAuthorization)
      .expect(403);
    await request(app)
      .get(`/api/purchase-orders/${purchaseOrderId}`)
      .set("Authorization", managerAuthorization)
      .expect(404);
    await request(app)
      .patch(`/api/purchase-orders/${purchaseOrderId}/status`)
      .set("Authorization", warehouseAuthorization)
      .send({ status: "PENDING" })
      .expect(404);
    await request(app)
      .get(`/api/purchase-orders/${purchaseOrderId}`)
      .set("Authorization", adminAuthorization)
      .expect(200);
  } finally {
    if (purchaseOrderId) {
      await prisma.purchaseOrder.delete({ where: { id: purchaseOrderId } });
    }
  }

  const otherOrder = await prisma.order.findFirst({
    where: { branchId: otherBranch.id },
    select: { id: true },
  });
  assert.ok(otherOrder);
  const [managerOrders, cashierOrders, adminOtherOrders] = await Promise.all([
    request(app).get("/api/orders?size=100").set("Authorization", managerAuthorization).expect(200),
    request(app).get("/api/orders?size=100").set("Authorization", cashierAuthorization).expect(200),
    request(app).get(`/api/orders?branchId=${otherBranch.id}&size=5`).set("Authorization", adminAuthorization).expect(200),
  ]);
  assert.ok(managerOrders.body.data.every((order) => order.branchId === ownBranchId));
  assert.ok(
    cashierOrders.body.data.every(
      (order) => order.branchId === cashierLogin.body.data.user.branch.id,
    ),
  );
  assert.ok(adminOtherOrders.body.data.every((order) => order.branchId === otherBranch.id));

  await request(app)
    .get(`/api/orders?branchId=${otherBranch.id}`)
    .set("Authorization", managerAuthorization)
    .expect(403);
  await request(app)
    .get(`/api/orders?branchId=${otherBranch.id}`)
    .set("Authorization", cashierAuthorization)
    .expect(403);
  for (const [path, authorization] of [
    [`/api/orders/${otherOrder.id}`, managerAuthorization],
    [`/api/orders/${otherOrder.id}`, cashierAuthorization],
    [`/api/orders/${otherOrder.id}/invoice.pdf`, managerAuthorization],
    [`/api/payments/order/${otherOrder.id}`, managerAuthorization],
  ]) {
    await request(app).get(path).set("Authorization", authorization).expect(404);
  }
  await request(app)
    .patch(`/api/orders/${otherOrder.id}/status`)
    .set("Authorization", managerAuthorization)
    .send({ status: "CANCELLED", note: "Không được phép truy cập" })
    .expect(404);
  await request(app)
    .post(`/api/orders/${otherOrder.id}/refunds`)
    .set("Authorization", managerAuthorization)
    .send({ amount: 1, method: "CASH", reason: "Không được phép truy cập" })
    .expect(404);
  await request(app)
    .post(`/api/payments/order/${otherOrder.id}`)
    .set("Authorization", managerAuthorization)
    .send({ amount: 1, method: "CASH" })
    .expect(404);
  await request(app)
    .get(`/api/orders/${otherOrder.id}`)
    .set("Authorization", adminAuthorization)
    .expect(200);
});

test("membership revenue report is accurate and branch scoped for every role", async () => {
  const [adminLogin, managerLogin, cashier02Login, warehouse02Login, staffLogin] = await Promise.all([
    request(app).post("/api/auth/login").send({ login: "admin", password: "IceCream@123" }).expect(200),
    request(app).post("/api/auth/login").send({ login: "manager", password: "IceCream@123" }).expect(200),
    request(app).post("/api/auth/login").send({ login: "cashier02", password: "IceCream@123" }).expect(200),
    request(app).post("/api/auth/login").send({ login: "warehouse02", password: "IceCream@123" }).expect(200),
    request(app).post("/api/auth/login").send({ login: "staff01", password: "IceCream@123" }).expect(200),
  ]);
  const authorization = {
    admin: `Bearer ${adminLogin.body.data.accessToken}`,
    manager: `Bearer ${managerLogin.body.data.accessToken}`,
    cashier02: `Bearer ${cashier02Login.body.data.accessToken}`,
    warehouse02: `Bearer ${warehouse02Login.body.data.accessToken}`,
    staff: `Bearer ${staffLogin.body.data.accessToken}`,
  };
  const branchOneId = managerLogin.body.data.user.branch.id;
  const branchTwoId = cashier02Login.body.data.user.branch.id;
  assert.notEqual(branchOneId, branchTwoId);

  const [plan, customers, managerUser, cashier02User] = await Promise.all([
    prisma.membershipPlan.findFirst({ orderBy: { createdAt: "asc" } }),
    prisma.customer.findMany({ take: 2, orderBy: { createdAt: "asc" } }),
    prisma.user.findUnique({ where: { username: "manager" } }),
    prisma.user.findUnique({ where: { username: "cashier02" } }),
  ]);
  assert.ok(plan);
  assert.equal(customers.length, 2);
  const suffix = Date.now().toString().slice(-8);
  const codes = [`HV-SCOPE-A-${suffix}`, `HV-SCOPE-B-${suffix}`, `HV-SCOPE-C-${suffix}`];
  const reportPath = "/api/reports/membership-revenue?from=2024-02-10&to=2024-02-10";

  try {
    await prisma.membershipSubscription.createMany({
      data: [
        {
          code: codes[0],
          customerId: customers[0].id,
          membershipPlanId: plan.id,
          branchId: branchOneId,
          createdById: managerUser.id,
          startsAt: new Date("2024-02-10T03:00:00.000Z"),
          endsAt: new Date("2024-03-11T03:00:00.000Z"),
          amountPaid: 111000,
          paymentMethod: "CASH",
          status: "EXPIRED",
          createdAt: new Date("2024-02-10T03:00:00.000Z"),
          updatedAt: new Date("2024-02-10T03:00:00.000Z"),
        },
        {
          code: codes[1],
          customerId: customers[0].id,
          membershipPlanId: plan.id,
          branchId: branchOneId,
          createdById: managerUser.id,
          startsAt: new Date("2024-03-11T03:00:00.000Z"),
          endsAt: new Date("2024-04-10T03:00:00.000Z"),
          amountPaid: 333000,
          paymentMethod: "CARD",
          status: "EXPIRED",
          createdAt: new Date("2024-02-10T04:00:00.000Z"),
          updatedAt: new Date("2024-02-10T04:00:00.000Z"),
        },
        {
          code: codes[2],
          customerId: customers[1].id,
          membershipPlanId: plan.id,
          branchId: branchTwoId,
          createdById: cashier02User.id,
          startsAt: new Date("2024-02-10T05:00:00.000Z"),
          endsAt: new Date("2024-03-11T05:00:00.000Z"),
          amountPaid: 222000,
          paymentMethod: "BANK_TRANSFER",
          status: "EXPIRED",
          createdAt: new Date("2024-02-10T05:00:00.000Z"),
          updatedAt: new Date("2024-02-10T05:00:00.000Z"),
        },
      ],
    });

    const adminReport = await request(app)
      .get(reportPath)
      .set("Authorization", authorization.admin)
      .expect(200);
    assert.equal(adminReport.body.data.summary.revenue, 666000);
    assert.equal(adminReport.body.data.summary.subscriptions, 3);
    assert.equal(adminReport.body.data.summary.uniqueCustomers, 2);
    assert.equal(adminReport.body.data.summary.averageRevenue, 222000);
    assert.equal(adminReport.body.data.summary.newSubscriptions, 2);
    assert.equal(adminReport.body.data.summary.renewals, 1);
    assert.equal(adminReport.body.data.dailySeries.length, 1);
    assert.equal(adminReport.body.data.dailySeries[0].date, "2024-02-10");
    assert.equal(adminReport.body.data.planBreakdown[0].revenue, 666000);
    assert.equal(adminReport.body.data.branchBreakdown.length, 2);
    assert.equal(adminReport.body.data.paymentBreakdown.length, 3);
    assert.equal(adminReport.body.data.recentSubscriptions.length, 3);

    const [managerReport, cashierReport, warehouseReport, staffReport, adminBranchTwo] = await Promise.all([
      request(app).get(reportPath).set("Authorization", authorization.manager).expect(200),
      request(app).get(reportPath).set("Authorization", authorization.cashier02).expect(200),
      request(app).get(reportPath).set("Authorization", authorization.warehouse02).expect(200),
      request(app).get(reportPath).set("Authorization", authorization.staff).expect(200),
      request(app).get(`${reportPath}&branchId=${branchTwoId}`).set("Authorization", authorization.admin).expect(200),
    ]);
    assert.equal(managerReport.body.data.summary.revenue, 444000);
    assert.ok(managerReport.body.data.branchBreakdown.every((item) => item.id === branchOneId));
    assert.equal(cashierReport.body.data.summary.revenue, 222000);
    assert.ok(cashierReport.body.data.branchBreakdown.every((item) => item.id === branchTwoId));
    assert.equal(warehouseReport.body.data.summary.revenue, 222000);
    assert.equal(staffReport.body.data.summary.revenue, 444000);
    assert.equal(adminBranchTwo.body.data.summary.revenue, 222000);

    await request(app)
      .get(`${reportPath}&branchId=${branchTwoId}`)
      .set("Authorization", authorization.manager)
      .expect(403);
    await request(app)
      .get(`${reportPath}&branchId=${branchOneId}`)
      .set("Authorization", authorization.cashier02)
      .expect(403);
    await request(app)
      .get("/api/reports/membership-revenue?from=2024-02-11&to=2024-02-10")
      .set("Authorization", authorization.admin)
      .expect(422);

    const managerSubscriptions = await request(app)
      .get("/api/memberships/subscriptions")
      .set("Authorization", authorization.manager)
      .expect(200);
    assert.ok(managerSubscriptions.body.data.every((item) => item.branchId === branchOneId));
    await request(app)
      .get(`/api/memberships/subscriptions?branchId=${branchTwoId}`)
      .set("Authorization", authorization.manager)
      .expect(403);
    await request(app)
      .post("/api/memberships/subscriptions")
      .set("Authorization", authorization.manager)
      .send({
        customerId: customers[0].id,
        membershipPlanId: plan.id,
        branchId: branchTwoId,
        paymentMethod: "CASH",
      })
      .expect(403);
  } finally {
    await prisma.membershipSubscription.deleteMany({ where: { code: { in: codes } } });
  }
});
