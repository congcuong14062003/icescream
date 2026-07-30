import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { authenticate, requirePermission } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { created, success } from "../../utils/response.js";

const router = Router();
router.use(authenticate);

const schema = z.object({
  code: z.string().trim().min(2).max(30).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(3).max(150),
  address: z.string().trim().min(5).max(500),
  phone: z.string().trim().min(8).max(20),
  openingHours: z.string().trim().max(100).optional().nullable(),
  managerId: z.string().optional().nullable(),
  isActive: z.boolean().default(true),
});

router.get(
  "/",
  asyncHandler(async (request, response) => {
    const branches = await prisma.branch.findMany({
      where: { deletedAt: null },
      include: {
        manager: { select: { id: true, fullName: true } },
        _count: { select: { users: true, orders: true } },
      },
      orderBy: { name: "asc" },
    });
    return success(response, branches);
  }),
);

router.post(
  "/",
  requirePermission("users.manage"),
  validate(schema),
  asyncHandler(async (request, response) => {
    const branch = await prisma.branch.create({ data: request.body });
    return created(response, branch, "Tạo chi nhánh thành công");
  }),
);

router.put(
  "/:id",
  requirePermission("users.manage"),
  validate(schema.partial()),
  asyncHandler(async (request, response) => {
    const branch = await prisma.branch.update({
      where: { id: request.params.id },
      data: request.body,
    });
    return success(response, branch, "Cập nhật chi nhánh thành công");
  }),
);

export default router;

