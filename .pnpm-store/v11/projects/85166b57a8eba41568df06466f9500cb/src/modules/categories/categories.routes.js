import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { authenticate, requirePermission } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validate.js";
import { ApiError } from "../../utils/api-error.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { created, success } from "../../utils/response.js";
import { writeAudit } from "../../utils/audit.js";

const router = Router();
router.use(authenticate);

const schema = z.object({
  code: z.string().trim().min(2).max(30).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2).max(100),
  description: z.string().max(500).optional().nullable(),
  displayOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

router.get(
  "/",
  requirePermission("products.view", "pos.use"),
  asyncHandler(async (request, response) => {
    const items = await prisma.category.findMany({
      where: {
        deletedAt: null,
        ...(request.query.active === "true" ? { isActive: true } : {}),
      },
      include: { _count: { select: { products: { where: { deletedAt: null } } } } },
      orderBy: [{ displayOrder: "asc" }, { name: "asc" }],
    });
    return success(response, items);
  }),
);

router.post(
  "/",
  requirePermission("products.manage"),
  validate(schema),
  asyncHandler(async (request, response) => {
    const item = await prisma.category.create({ data: request.body });
    await writeAudit(prisma, request, "CATEGORY_CREATE", "Category", item.id, null, item);
    return created(response, item, "Tạo danh mục thành công");
  }),
);

router.put(
  "/:id",
  requirePermission("products.manage"),
  validate(schema.partial()),
  asyncHandler(async (request, response) => {
    const oldItem = await prisma.category.findUnique({ where: { id: request.params.id } });
    if (!oldItem || oldItem.deletedAt) throw new ApiError(404, "Không tìm thấy danh mục");
    const item = await prisma.category.update({
      where: { id: request.params.id },
      data: request.body,
    });
    await writeAudit(prisma, request, "CATEGORY_UPDATE", "Category", item.id, oldItem, item);
    return success(response, item, "Cập nhật danh mục thành công");
  }),
);

export default router;

