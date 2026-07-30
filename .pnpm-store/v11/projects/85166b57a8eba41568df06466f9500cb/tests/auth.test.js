import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../src/app.js";

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
