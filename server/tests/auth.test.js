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

  const [inventoryResponse, branchesResponse] = await Promise.all([
    request(app)
      .get(`/api/inventory?branchId=${ownBranchId}&size=100`)
      .set("Authorization", authorization)
      .expect(200),
    request(app)
      .get("/api/branches")
      .set("Authorization", authorization)
      .expect(200),
  ]);
  const inventoryLine = inventoryResponse.body.data.find((item) => item.quantity >= 2);
  assert.ok(inventoryLine);

  const otherBranch = branchesResponse.body.data.find((branch) => branch.id !== ownBranchId);
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
