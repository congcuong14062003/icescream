import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { authenticate, requirePermission } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { getPagination, paginationMeta } from "../../utils/pagination.js";
import { created, success } from "../../utils/response.js";

const router = Router();
router.use(authenticate, requirePermission("suppliers.manage"));

const schema = z.object({
  code: z.string().trim().min(2).max(30).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2).max(150),
  contactPerson: z.string().trim().max(100).optional().nullable(),
  phone: z.string().trim().max(20).optional().nullable(),
  email: z.string().email().optional().nullable().or(z.literal("")),
  address: z.string().trim().max(500).optional().nullable(),
  isActive: z.boolean().default(true),
});

router.get(
  "/",
  asyncHandler(async (request, response) => {
    const { page, size, skip } = getPagination(request.query);
    const search = String(request.query.search || "").trim();
    const where = {
      deletedAt: null,
      ...(search ? { OR: [{ code: { contains: search } }, { name: { contains: search } }] } : {}),
    };
    const [items, total] = await Promise.all([
      prisma.supplier.findMany({
        where,
        include: { _count: { select: { ingredients: true, purchaseOrders: true } } },
        orderBy: { name: "asc" },
        skip,
        take: size,
      }),
      prisma.supplier.count({ where }),
    ]);
    return success(response, items, "Lấy nhà cung cấp thành công", paginationMeta(page, size, total));
  }),
);

router.post(
  "/",
  validate(schema),
  asyncHandler(async (request, response) => {
    const item = await prisma.supplier.create({
      data: { ...request.body, email: request.body.email || null },
    });
    return created(response, item, "Tạo nhà cung cấp thành công");
  }),
);

router.put(
  "/:id",
  validate(schema.partial()),
  asyncHandler(async (request, response) => {
    const item = await prisma.supplier.update({
      where: { id: request.params.id },
      data: {
        ...request.body,
        ...(request.body.email !== undefined ? { email: request.body.email || null } : {}),
      },
    });
    return success(response, item, "Cập nhật nhà cung cấp thành công");
  }),
);

export default router;

