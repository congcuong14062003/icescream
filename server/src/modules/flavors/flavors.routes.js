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
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/),
  imageUrl: z.string().url().optional().nullable().or(z.literal("")),
  extraPrice: sellingPriceSchema.default(0),
  status: z.enum(["AVAILABLE", "OUT_OF_STOCK", "INACTIVE"]).default("AVAILABLE"),
  ingredients: z
    .array(z.object({ ingredientId: z.string(), quantity: z.coerce.number().positive() }))
    .optional(),
});

router.get(
  "/",
  requirePermission("products.view", "pos.use"),
  asyncHandler(async (request, response) => {
    const { page, size, skip } = getPagination(request.query);
    const search = String(request.query.search || "").trim();
    const where = {
      deletedAt: null,
      ...(request.query.status ? { status: request.query.status } : {}),
      ...(search ? { OR: [{ name: { contains: search } }, { code: { contains: search } }] } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.flavor.findMany({
        where,
        include: {
          ingredients: {
            include: { ingredient: { select: { id: true, code: true, name: true, unit: true } } },
          },
        },
        orderBy: { name: "asc" },
        skip,
        take: size,
      }),
      prisma.flavor.count({ where }),
    ]);
    return success(response, items, "Lấy danh sách hương vị thành công", paginationMeta(page, size, total));
  }),
);

router.post(
  "/",
  requirePermission("products.manage"),
  validate(schema),
  asyncHandler(async (request, response) => {
    const { ingredients = [], imageUrl, ...data } = request.body;
    const item = await prisma.flavor.create({
      data: {
        ...data,
        imageUrl: imageUrl || null,
        ingredients: { create: ingredients },
      },
      include: { ingredients: { include: { ingredient: true } } },
    });
    await writeAudit(prisma, request, "FLAVOR_CREATE", "Flavor", item.id, null, data);
    return created(response, item, "Tạo hương vị thành công");
  }),
);

router.put(
  "/:id",
  requirePermission("products.manage"),
  validate(schema.partial()),
  asyncHandler(async (request, response) => {
    const oldItem = await prisma.flavor.findUnique({ where: { id: request.params.id } });
    if (!oldItem || oldItem.deletedAt) throw new ApiError(404, "Không tìm thấy hương vị");
    const { ingredients, imageUrl, ...data } = request.body;
    const item = await prisma.$transaction(async (tx) => {
      if (ingredients) {
        await tx.flavorIngredient.deleteMany({ where: { flavorId: oldItem.id } });
      }
      return tx.flavor.update({
        where: { id: oldItem.id },
        data: {
          ...data,
          ...(imageUrl !== undefined ? { imageUrl: imageUrl || null } : {}),
          ...(ingredients ? { ingredients: { create: ingredients } } : {}),
        },
        include: { ingredients: { include: { ingredient: true } } },
      });
    });
    await writeAudit(prisma, request, "FLAVOR_UPDATE", "Flavor", item.id, oldItem, data);
    if (request.body.extraPrice !== undefined && item.extraPrice !== oldItem.extraPrice) {
      emitCatalogEvent("catalog:price-updated", {
        type: "FLAVOR",
        id: item.id,
        extraPrice: item.extraPrice,
      });
    }
    return success(response, item, "Cập nhật hương vị thành công");
  }),
);

export default router;
