import test from "node:test";
import assert from "node:assert/strict";
import request from "supertest";
import app from "../src/app.js";

test("health endpoint uses the unified response shape", async () => {
  const response = await request(app).get("/api/health").expect(200);
  assert.equal(response.body.success, true);
  assert.equal(response.body.data.database, "SQLite");
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
