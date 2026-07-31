import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { authenticate, requirePermission } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { created, success } from "../../utils/response.js";
import { getPagination, paginationMeta } from "../../utils/pagination.js";
import { ApiError } from "../../utils/api-error.js";
import { writeAudit } from "../../utils/audit.js";
import { emitCatalogEvent } from "../../services/socket.service.js";

const router = Router();
router.use(authenticate);

const sellingPriceSchema = z.preprocess(
  (value) => (value === null || (typeof value === "string" && !value.trim()) ? Number.NaN : value),
  z.coerce.number().int().min(0).max(1000000000),
);

const schema = z.object({
  code: z.string().trim().min(2).max(30).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2).max(100),
  imageUrl: z.string().url().optional().nullable().or(z.literal("")),
  price: sellingPriceSchema,
  costPrice: sellingPriceSchema,
  stockStatus: z.enum(["AVAILABLE", "OUT_OF_STOCK", "INACTIVE"]).default("AVAILABLE"),
});

router.get(
  "/",
  requirePermission("products.view", "pos.use"),
  asyncHandler(async (request, response) => {
    const { page, size, skip } = getPagination(request.query);
    const search = String(request.query.search || "").trim();
    const where = {
      deletedAt: null,
      ...(request.query.status ? { stockStatus: request.query.status } : {}),
      ...(search ? { OR: [{ name: { contains: search } }, { code: { contains: search } }] } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.topping.findMany({ where, orderBy: { name: "asc" }, skip, take: size }),
      prisma.topping.count({ where }),
    ]);
    return success(response, items, "Lấy danh sách topping thành công", paginationMeta(page, size, total));
  }),
);

router.post(
  "/",
  requirePermission("products.manage"),
  validate(schema),
  asyncHandler(async (request, response) => {
    const item = await prisma.topping.create({
      data: { ...request.body, imageUrl: request.body.imageUrl || null },
    });
    await writeAudit(prisma, request, "TOPPING_CREATE", "Topping", item.id, null, item);
    return created(response, item, "Tạo topping thành công");
  }),
);

router.put(
  "/:id",
  requirePermission("products.manage"),
  validate(schema.partial()),
  asyncHandler(async (request, response) => {
    const oldItem = await prisma.topping.findUnique({ where: { id: request.params.id } });
    if (!oldItem || oldItem.deletedAt) throw new ApiError(404, "Không tìm thấy topping");
    const item = await prisma.topping.update({
      where: { id: oldItem.id },
      data: {
        ...request.body,
        ...(request.body.imageUrl !== undefined ? { imageUrl: request.body.imageUrl || null } : {}),
      },
    });
    await writeAudit(prisma, request, "TOPPING_UPDATE", "Topping", item.id, oldItem, item);
    if (request.body.price !== undefined && item.price !== oldItem.price) {
      emitCatalogEvent("catalog:price-updated", {
        type: "TOPPING",
        id: item.id,
        price: item.price,
      });
    }
    return success(response, item, "Cập nhật topping thành công");
  }),
);

export default router;
