import { Router } from "express";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { authenticate, requirePermission } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validate.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { ApiError } from "../../utils/api-error.js";
import { created, success } from "../../utils/response.js";
import { getManagedBranchIds, assertBranchAccess, branchWhere } from "../../services/branch-access.service.js";

const router = Router();
router.use(authenticate, requirePermission("reports.view"));

const categories = ["COGS", "PERSONNEL", "RENT", "UTILITIES", "MARKETING", "OPERATIONS", "SHRINKAGE", "MAINTENANCE", "FINANCE", "TAX", "DEPRECIATION", "OTHER"];
const categoryLabels = {
  COGS: "Giá vốn hàng bán (COGS)",
  PERSONNEL: "Chi phí nhân sự",
  RENT: "Chi phí mặt bằng",
  UTILITIES: "Chi phí điện nước",
  MARKETING: "Chi phí Marketing",
  OPERATIONS: "Chi phí vận hành",
  SHRINKAGE: "Chi phí hao hụt",
  MAINTENANCE: "Chi phí bảo trì",
  FINANCE: "Chi phí tài chính",
  TAX: "Thuế",
  DEPRECIATION: "Khấu hao tài sản",
  OTHER: "Chi phí khác",
};
const dateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const expenseSchema = z.object({
  branchId: z.string().min(1),
  category: z.enum(categories),
  amount: z.coerce.number().int().positive(),
  description: z.string().trim().max(1000).optional().nullable(),
  incurredAt: z.coerce.date().optional(),
});
const querySchema = z.object({
  branchId: z.preprocess((value) => value === "" ? undefined : value, z.string().trim().min(1).optional()),
  category: z.preprocess((value) => value === "" ? undefined : value, z.enum(categories).optional()),
  from: z.preprocess((value) => value === "" ? undefined : value, dateSchema.optional()),
  to: z.preprocess((value) => value === "" ? undefined : value, dateSchema.optional()),
  page: z.coerce.number().int().positive().default(1),
  size: z.coerce.number().int().positive().max(100).default(50),
}).superRefine((value, context) => {
  if (value.from && value.to && value.from > value.to) {
    context.addIssue({ code: z.ZodIssueCode.custom, path: ["from"], message: "Từ ngày phải nhỏ hơn hoặc bằng đến ngày" });
  }
});

function dateRange(from, to) {
  return {
    ...(from ? { gte: new Date(`${from}T00:00:00.000`) } : {}),
    ...(to ? { lt: new Date(new Date(`${to}T00:00:00.000`).getTime() + 86400000) } : {}),
  };
}

async function findExpense(id, user) {
  const allowedBranchIds = await getManagedBranchIds(prisma, user);
  const expense = await prisma.expense.findFirst({
    where: { id, ...branchWhere(allowedBranchIds) },
    include: { branch: { select: { id: true, code: true, name: true } }, createdBy: { select: { id: true, fullName: true } } },
  });
  if (!expense) throw new ApiError(404, "Không tìm thấy khoản chi phí");
  return expense;
}

router.get("/meta", asyncHandler(async (_request, response) => {
  return success(response, { categories });
}));

router.get("/", validate(querySchema, "query"), asyncHandler(async (request, response) => {
  const query = request.query;
  const allowedBranchIds = await getManagedBranchIds(prisma, request.user);
  if (query.branchId && allowedBranchIds && !allowedBranchIds.includes(query.branchId)) {
    throw new ApiError(403, "Bạn không được xem chi phí của chi nhánh này");
  }
  const where = {
    ...branchWhere(query.branchId ? [query.branchId] : allowedBranchIds),
    ...(query.category ? { category: query.category } : {}),
    ...(query.from || query.to ? { incurredAt: dateRange(query.from, query.to) } : {}),
  };
  const skip = (query.page - 1) * query.size;
  const [items, total, summary] = await Promise.all([
    prisma.expense.findMany({ where, include: { branch: { select: { id: true, code: true, name: true } }, createdBy: { select: { id: true, fullName: true } } }, orderBy: [{ incurredAt: "desc" }, { createdAt: "desc" }], skip, take: query.size }),
    prisma.expense.count({ where }),
    prisma.expense.groupBy({ by: ["category"], where, _sum: { amount: true } }),
  ]);
  return success(response, { items, total, page: query.page, size: query.size, totalAmount: summary.reduce((sum, item) => sum + (item._sum.amount || 0), 0), byCategory: summary.map((item) => ({ category: item.category, amount: item._sum.amount || 0 })) });
}));

router.post("/", validate(expenseSchema), asyncHandler(async (request, response) => {
  await assertBranchAccess(prisma, request.user, request.body.branchId, "Bạn chỉ được ghi chi phí tại chi nhánh được phân công");
  const item = await prisma.expense.create({ data: { ...request.body, description: request.body.description || categoryLabels[request.body.category], incurredAt: request.body.incurredAt || new Date(), createdById: request.user.id }, include: { branch: { select: { id: true, code: true, name: true } }, createdBy: { select: { id: true, fullName: true } } } });
  return created(response, item, "Ghi nhận chi phí thành công");
}));

router.put("/:id", validate(expenseSchema.partial().omit({ branchId: true })), asyncHandler(async (request, response) => {
  const existing = await findExpense(request.params.id, request.user);
  const item = await prisma.expense.update({ where: { id: existing.id }, data: { ...request.body, ...(request.body.description === "" || request.body.description == null ? { description: categoryLabels[request.body.category || existing.category] } : {}) }, include: { branch: { select: { id: true, code: true, name: true } }, createdBy: { select: { id: true, fullName: true } } } });
  return success(response, item, "Cập nhật chi phí thành công");
}));

router.delete("/:id", asyncHandler(async (request, response) => {
  const existing = await findExpense(request.params.id, request.user);
  await prisma.expense.delete({ where: { id: existing.id } });
  return success(response, null, "Xóa chi phí thành công");
}));

export default router;
