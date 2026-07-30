import express from "express";
import path from "node:path";
import { fileURLToPath } from "node:url";
import cors from "cors";
import cookieParser from "cookie-parser";
import helmet from "helmet";
import rateLimit from "express-rate-limit";
import { env } from "./config/env.js";
import { errorHandler, notFound } from "./middlewares/error-handler.js";
import authRoutes from "./modules/auth/auth.routes.js";
import usersRoutes from "./modules/users/users.routes.js";
import branchesRoutes from "./modules/branches/branches.routes.js";
import categoriesRoutes from "./modules/categories/categories.routes.js";
import productsRoutes from "./modules/products/products.routes.js";
import flavorsRoutes from "./modules/flavors/flavors.routes.js";
import toppingsRoutes from "./modules/toppings/toppings.routes.js";
import customersRoutes from "./modules/customers/customers.routes.js";
import promotionsRoutes from "./modules/promotions/promotions.routes.js";
import ordersRoutes from "./modules/orders/orders.routes.js";
import paymentsRoutes from "./modules/payments/payments.routes.js";
import inventoryRoutes from "./modules/inventory/inventory.routes.js";
import suppliersRoutes from "./modules/suppliers/suppliers.routes.js";
import purchaseOrdersRoutes from "./modules/purchase-orders/purchase-orders.routes.js";
import shiftsRoutes from "./modules/shifts/shifts.routes.js";
import reportsRoutes from "./modules/reports/reports.routes.js";
import membershipsRoutes from "./modules/memberships/memberships.routes.js";
import { success } from "./utils/response.js";

const app = express();
const directory = path.dirname(fileURLToPath(import.meta.url));
const allowedOrigins = new Set([
  env.CLIENT_URL,
  "http://localhost:5173",
  "http://127.0.0.1:5173",
]);

app.disable("x-powered-by");
app.set("trust proxy", 1);
app.use(
  helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
  }),
);
app.use(
  cors({
    origin(origin, callback) {
      if (!origin || allowedOrigins.has(origin)) return callback(null, true);
      return callback(new Error("Nguồn truy cập không được CORS cho phép"));
    },
    credentials: true,
    methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
  }),
);
app.use(express.json({ limit: "2mb" }));
app.use(express.urlencoded({ extended: true, limit: "2mb" }));
app.use(cookieParser());
app.use("/uploads", express.static(path.resolve(directory, "../uploads")));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 100,
  standardHeaders: "draft-7",
  legacyHeaders: false,
  message: {
    success: false,
    message: "Quá nhiều yêu cầu, vui lòng thử lại sau",
    data: null,
  },
});

app.get("/api/health", (request, response) =>
  success(response, {
    service: "IceCream POS API",
    database: "MySQL",
    time: new Date().toISOString(),
  }),
);

app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/users", usersRoutes);
app.use("/api/branches", branchesRoutes);
app.use("/api/categories", categoriesRoutes);
app.use("/api/products", productsRoutes);
app.use("/api/flavors", flavorsRoutes);
app.use("/api/toppings", toppingsRoutes);
app.use("/api/customers", customersRoutes);
app.use("/api/promotions", promotionsRoutes);
app.use("/api/orders", ordersRoutes);
app.use("/api/payments", paymentsRoutes);
app.use("/api/inventory", inventoryRoutes);
app.use("/api/suppliers", suppliersRoutes);
app.use("/api/purchase-orders", purchaseOrdersRoutes);
app.use("/api/shifts", shiftsRoutes);
app.use("/api/reports", reportsRoutes);
app.use("/api/memberships", membershipsRoutes);

app.use(notFound);
app.use(errorHandler);

export default app;
