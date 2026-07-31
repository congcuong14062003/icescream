import { Router } from "express";
import { existsSync, mkdirSync } from "node:fs";
import path from "node:path";
import multer from "multer";
import { z } from "zod";
import { prisma } from "../../config/prisma.js";
import { env } from "../../config/env.js";
import { cloudinary, hasCloudinary } from "../../config/cloudinary.js";
import { authenticate, requirePermission } from "../../middlewares/auth.js";
import { validate } from "../../middlewares/validate.js";
import { ApiError } from "../../utils/api-error.js";
import { asyncHandler } from "../../utils/async-handler.js";
import { getPagination, paginationMeta } from "../../utils/pagination.js";
import { created, success } from "../../utils/response.js";
import { writeAudit } from "../../utils/audit.js";

const router = Router();
router.use(authenticate);

const variantSchema = z.object({
  id: z.string().optional(),
  sku: z.string().trim().min(2).max(50).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(1).max(80),
  size: z.string().trim().max(20).optional().nullable(),
  cupType: z.string().trim().max(50).optional().nullable(),
  scoopCount: z.coerce.number().int().min(0).max(12).default(1),
  price: z.coerce.number().int().min(0),
  costPrice: z.coerce.number().int().min(0),
  isActive: z.boolean().default(true),
});

const productSchema = z.object({
  code: z.string().trim().min(2).max(30).transform((value) => value.toUpperCase()),
  name: z.string().trim().min(2).max(150),
  categoryId: z.string().min(1),
  description: z.string().max(2000).optional().nullable(),
  imageUrl: z.string().url().optional().nullable().or(z.literal("")),
  price: z.coerce.number().int().min(0),
  costPrice: z.coerce.number().int().min(0),
  status: z.enum(["ACTIVE", "INACTIVE", "OUT_OF_STOCK"]).default("ACTIVE"),
  isFeatured: z.boolean().default(false),
  displayOrder: z.coerce.number().int().min(0).default(0),
  variants: z.array(variantSchema).min(1),
});

const recipeLineSchema = z.object({
  ingredientId: z.string().min(1),
  quantity: z.coerce.number().positive().max(1000000000),
  note: z.string().trim().max(300).optional().nullable(),
});

const recipeConfigSchema = z.object({
  productRecipes: z.array(recipeLineSchema).max(100).default([]),
  variants: z.array(z.object({
    variantId: z.string().min(1),
    recipes: z.array(recipeLineSchema).max(100).default([]),
  })).min(1),
  flavorRecipes: z.array(z.object({
    flavorId: z.string().min(1),
    recipes: z.array(recipeLineSchema).max(100).default([]),
  })).max(200).optional(),
  toppingRecipes: z.array(z.object({
    toppingId: z.string().min(1),
    recipes: z.array(recipeLineSchema).max(100).default([]),
  })).max(200).optional(),
}).superRefine((data, context) => {
  const validateUniqueIngredients = (recipes, path) => {
    const ids = recipes.map((recipe) => recipe.ingredientId);
    if (new Set(ids).size !== ids.length) {
      context.addIssue({
        code: z.ZodIssueCode.custom,
        path,
        message: "Một nguyên liệu không được lặp lại trong cùng công thức",
      });
    }
  };
  validateUniqueIngredients(data.productRecipes, ["productRecipes"]);
  const variantIds = data.variants.map((variant) => variant.variantId);
  if (new Set(variantIds).size !== variantIds.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["variants"],
      message: "Biến thể không được lặp lại",
    });
  }
  data.variants.forEach((variant, index) => {
    validateUniqueIngredients(variant.recipes, ["variants", index, "recipes"]);
  });
  const flavorIds = (data.flavorRecipes || []).map((flavor) => flavor.flavorId);
  if (new Set(flavorIds).size !== flavorIds.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["flavorRecipes"],
      message: "Hương vị không được lặp lại",
    });
  }
  (data.flavorRecipes || []).forEach((flavor, index) => {
    validateUniqueIngredients(flavor.recipes, ["flavorRecipes", index, "recipes"]);
  });
  const toppingIds = (data.toppingRecipes || []).map((topping) => topping.toppingId);
  if (new Set(toppingIds).size !== toppingIds.length) {
    context.addIssue({
      code: z.ZodIssueCode.custom,
      path: ["toppingRecipes"],
      message: "Topping không được lặp lại",
    });
  }
  (data.toppingRecipes || []).forEach((topping, index) => {
    validateUniqueIngredients(topping.recipes, ["toppingRecipes", index, "recipes"]);
  });
});

const productInclude = {
  category: { select: { id: true, code: true, name: true } },
  variants: { orderBy: { price: "asc" } },
  images: { orderBy: { displayOrder: "asc" } },
};
const recipeInclude = {
  ingredient: { select: { id: true, code: true, name: true, unit: true, averageCost: true } },
};

router.get(
  "/",
  requirePermission("products.view", "pos.use"),
  asyncHandler(async (request, response) => {
    const { page, size, skip } = getPagination(request.query);
    const search = String(request.query.search || "").trim();
    const where = {
      deletedAt: null,
      ...(request.query.categoryId ? { categoryId: request.query.categoryId } : {}),
      ...(request.query.status ? { status: request.query.status } : {}),
      ...(request.query.featured === "true" ? { isFeatured: true } : {}),
      ...(search
        ? {
            OR: [
              { name: { contains: search } },
              { code: { contains: search } },
              { variants: { some: { sku: { contains: search } } } },
            ],
          }
        : {}),
    };
    const [items, total] = await Promise.all([
      prisma.product.findMany({
        where,
        include: productInclude,
        orderBy: [{ displayOrder: "asc" }, { createdAt: "desc" }],
        skip,
        take: size,
      }),
      prisma.product.count({ where }),
    ]);
    return success(response, items, "Lấy danh sách sản phẩm thành công", paginationMeta(page, size, total));
  }),
);

router.get(
  "/recipes/meta",
  requirePermission("products.manage"),
  asyncHandler(async (request, response) => {
    const ingredients = await prisma.ingredient.findMany({
      where: { deletedAt: null },
      select: { id: true, code: true, name: true, unit: true, isActive: true },
      orderBy: { name: "asc" },
    });
    return success(response, { ingredients });
  }),
);

router.get(
  "/:id",
  requirePermission("products.view", "pos.use"),
  asyncHandler(async (request, response) => {
    const [item, flavorRecipes, toppingRecipes] = await Promise.all([
      prisma.product.findFirst({
        where: { id: request.params.id, deletedAt: null },
        include: {
          ...productInclude,
          variants: {
            include: { recipes: { include: recipeInclude } },
            orderBy: { price: "asc" },
          },
          recipes: { include: recipeInclude },
        },
      }),
      prisma.flavor.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          code: true,
          name: true,
          color: true,
          recipes: { include: recipeInclude },
        },
        orderBy: { name: "asc" },
      }),
      prisma.topping.findMany({
        where: { deletedAt: null },
        select: {
          id: true,
          code: true,
          name: true,
          recipes: { include: recipeInclude },
        },
        orderBy: { name: "asc" },
      }),
    ]);
    if (!item) throw new ApiError(404, "Không tìm thấy sản phẩm");
    return success(response, { ...item, flavorRecipes, toppingRecipes });
  }),
);

router.post(
  "/",
  requirePermission("products.manage"),
  validate(productSchema),
  asyncHandler(async (request, response) => {
    const { variants, imageUrl, ...data } = request.body;
    const item = await prisma.product.create({
      data: {
        ...data,
        imageUrl: imageUrl || null,
        variants: { create: variants.map(({ id, ...variant }) => variant) },
      },
      include: productInclude,
    });
    await writeAudit(prisma, request, "PRODUCT_CREATE", "Product", item.id, null, {
      code: item.code,
      name: item.name,
    });
    return created(response, item, "Tạo sản phẩm thành công");
  }),
);

router.put(
  "/:id",
  requirePermission("products.manage"),
  validate(productSchema),
  asyncHandler(async (request, response) => {
    const oldItem = await prisma.product.findFirst({
      where: { id: request.params.id, deletedAt: null },
      include: { variants: true },
    });
    if (!oldItem) throw new ApiError(404, "Không tìm thấy sản phẩm");
    const { variants, imageUrl, ...data } = request.body;
    const existingVariantIds = new Set(oldItem.variants.map((variant) => variant.id));
    const submittedIds = variants.map((variant) => variant.id).filter(Boolean);
    if (
      submittedIds.some((id) => !existingVariantIds.has(id))
      || new Set(submittedIds).size !== submittedIds.length
    ) {
      throw new ApiError(422, "Danh sách biến thể không hợp lệ cho sản phẩm này");
    }
    const item = await prisma.$transaction(async (tx) => {
      await tx.productVariant.updateMany({
        where: { productId: oldItem.id, id: { notIn: submittedIds } },
        data: { isActive: false },
      });
      for (const variant of variants) {
        const { id, ...variantData } = variant;
        if (id) {
          await tx.productVariant.update({
            where: { id },
            data: variantData,
          });
        } else {
          await tx.productVariant.create({
            data: { ...variantData, productId: oldItem.id },
          });
        }
      }
      return tx.product.update({
        where: { id: oldItem.id },
        data: { ...data, imageUrl: imageUrl || null },
        include: productInclude,
      });
    });
    await writeAudit(prisma, request, "PRODUCT_UPDATE", "Product", item.id, {
      code: oldItem.code,
      name: oldItem.name,
      status: oldItem.status,
    }, {
      code: item.code,
      name: item.name,
      status: item.status,
    });
    return success(response, item, "Cập nhật sản phẩm thành công");
  }),
);

router.put(
  "/:id/recipes",
  requirePermission("products.manage"),
  validate(recipeConfigSchema),
  asyncHandler(async (request, response) => {
    const existing = await prisma.product.findFirst({
      where: { id: request.params.id, deletedAt: null },
      include: {
        recipes: true,
        variants: { include: { recipes: true }, orderBy: { price: "asc" } },
      },
    });
    if (!existing) throw new ApiError(404, "Không tìm thấy sản phẩm");

    const submittedFlavorRecipes = request.body.flavorRecipes;
    const submittedToppingRecipes = request.body.toppingRecipes;
    const submittedFlavorIds = (submittedFlavorRecipes || []).map((flavor) => flavor.flavorId);
    const submittedToppingIds = (submittedToppingRecipes || []).map((topping) => topping.toppingId);
    const expectedVariantIds = existing.variants.map((variant) => variant.id);
    const submittedVariantIds = request.body.variants.map((variant) => variant.variantId);
    if (
      submittedVariantIds.length !== expectedVariantIds.length
      || submittedVariantIds.some((id) => !expectedVariantIds.includes(id))
    ) {
      throw new ApiError(422, "Công thức phải bao gồm đúng các biến thể của sản phẩm");
    }

    const [existingFlavors, existingToppings] = await Promise.all([
      submittedFlavorRecipes
        ? prisma.flavor.findMany({
            where: { id: { in: submittedFlavorIds }, deletedAt: null },
            select: { id: true, recipes: true },
          })
        : [],
      submittedToppingRecipes
        ? prisma.topping.findMany({
            where: { id: { in: submittedToppingIds }, deletedAt: null },
            select: { id: true, recipes: true },
          })
        : [],
    ]);
    if (submittedFlavorRecipes && existingFlavors.length !== submittedFlavorIds.length) {
      throw new ApiError(422, "Một hương vị không tồn tại hoặc đã bị xóa");
    }
    if (submittedToppingRecipes && existingToppings.length !== submittedToppingIds.length) {
      throw new ApiError(422, "Một topping không tồn tại hoặc đã bị xóa");
    }

    const ingredientIds = [...new Set([
      ...request.body.productRecipes.map((recipe) => recipe.ingredientId),
      ...request.body.variants.flatMap((variant) => variant.recipes.map((recipe) => recipe.ingredientId)),
      ...(submittedFlavorRecipes || []).flatMap((flavor) => flavor.recipes.map((recipe) => recipe.ingredientId)),
      ...(submittedToppingRecipes || []).flatMap((topping) => topping.recipes.map((recipe) => recipe.ingredientId)),
    ])];
    const ingredientCount = ingredientIds.length
      ? await prisma.ingredient.count({ where: { id: { in: ingredientIds }, deletedAt: null } })
      : 0;
    if (ingredientCount !== ingredientIds.length) {
      throw new ApiError(422, "Một nguyên liệu không tồn tại hoặc đã bị xóa");
    }

    const oldData = {
      productRecipes: existing.recipes.map(({ ingredientId, quantity, note }) => ({ ingredientId, quantity, note })),
      variants: existing.variants.map((variant) => ({
        variantId: variant.id,
        recipes: variant.recipes.map(({ ingredientId, quantity, note }) => ({ ingredientId, quantity, note })),
      })),
      ...(submittedFlavorRecipes ? {
        flavorRecipes: existingFlavors.map((flavor) => ({
          flavorId: flavor.id,
          recipes: flavor.recipes.map(({ ingredientId, quantity, note }) => ({ ingredientId, quantity, note })),
        })),
      } : {}),
      ...(submittedToppingRecipes ? {
        toppingRecipes: existingToppings.map((topping) => ({
          toppingId: topping.id,
          recipes: topping.recipes.map(({ ingredientId, quantity, note }) => ({ ingredientId, quantity, note })),
        })),
      } : {}),
    };
    const item = await prisma.$transaction(async (tx) => {
      const recipeScopes = [
        { productId: existing.id },
        { variantId: { in: expectedVariantIds } },
        ...(submittedFlavorRecipes ? [{ flavorId: { in: submittedFlavorIds } }] : []),
        ...(submittedToppingRecipes ? [{ toppingId: { in: submittedToppingIds } }] : []),
      ];
      await tx.productRecipe.deleteMany({
        where: { OR: recipeScopes },
      });
      const recipes = [
        ...request.body.productRecipes.map((recipe) => ({
          productId: existing.id,
          ingredientId: recipe.ingredientId,
          quantity: recipe.quantity,
          note: recipe.note || null,
        })),
        ...request.body.variants.flatMap((variant) => variant.recipes.map((recipe) => ({
          variantId: variant.variantId,
          ingredientId: recipe.ingredientId,
          quantity: recipe.quantity,
          note: recipe.note || null,
        }))),
        ...(submittedFlavorRecipes || []).flatMap((flavor) => flavor.recipes.map((recipe) => ({
          flavorId: flavor.flavorId,
          ingredientId: recipe.ingredientId,
          quantity: recipe.quantity,
          note: recipe.note || null,
        }))),
        ...(submittedToppingRecipes || []).flatMap((topping) => topping.recipes.map((recipe) => ({
          toppingId: topping.toppingId,
          ingredientId: recipe.ingredientId,
          quantity: recipe.quantity,
          note: recipe.note || null,
        }))),
      ];
      if (recipes.length) {
        await tx.productRecipe.createMany({ data: recipes });
      }
      await tx.auditLog.create({
        data: {
          userId: request.user.id,
          action: "PRODUCT_RECIPE_UPDATE",
          entityType: "Product",
          entityId: existing.id,
          oldData,
          newData: request.body,
          ipAddress: request.ip,
          userAgent: request.get("user-agent"),
        },
      });
      const updatedProduct = await tx.product.findUnique({
        where: { id: existing.id },
        include: {
          ...productInclude,
          variants: {
            include: { recipes: { include: recipeInclude } },
            orderBy: { price: "asc" },
          },
          recipes: { include: recipeInclude },
        },
      });
      const [flavorRecipes, toppingRecipes] = await Promise.all([
        tx.flavor.findMany({
          where: { deletedAt: null },
          select: {
            id: true,
            code: true,
            name: true,
            color: true,
            recipes: { include: recipeInclude },
          },
          orderBy: { name: "asc" },
        }),
        tx.topping.findMany({
          where: { deletedAt: null },
          select: {
            id: true,
            code: true,
            name: true,
            recipes: { include: recipeInclude },
          },
          orderBy: { name: "asc" },
        }),
      ]);
      return { ...updatedProduct, flavorRecipes, toppingRecipes };
    });
    return success(response, item, "Cập nhật công thức sản phẩm thành công");
  }),
);

router.delete(
  "/:id",
  requirePermission("products.manage"),
  asyncHandler(async (request, response) => {
    const item = await prisma.product.findFirst({
      where: { id: request.params.id, deletedAt: null },
      include: { _count: { select: { orderItems: true } } },
    });
    if (!item) throw new ApiError(404, "Không tìm thấy sản phẩm");
    if (item._count.orderItems > 0) {
      throw new ApiError(422, "Sản phẩm đã phát sinh giao dịch, chỉ có thể ngừng bán");
    }
    await prisma.product.update({
      where: { id: item.id },
      data: { deletedAt: new Date(), status: "INACTIVE" },
    });
    await writeAudit(prisma, request, "PRODUCT_DELETE", "Product", item.id, item, null);
    return success(response, {}, "Xóa sản phẩm thành công");
  }),
);

const uploadDirectory = path.resolve("uploads");
if (!existsSync(uploadDirectory)) mkdirSync(uploadDirectory, { recursive: true });

const upload = multer({
  storage: hasCloudinary
    ? multer.memoryStorage()
    : multer.diskStorage({
        destination: uploadDirectory,
        filename: (request, file, callback) => {
          const extension = path.extname(file.originalname).toLowerCase();
          callback(null, `${Date.now()}-${Math.random().toString(16).slice(2)}${extension}`);
        },
      }),
  limits: { fileSize: env.MAX_FILE_SIZE_MB * 1024 * 1024 },
  fileFilter: (request, file, callback) => {
    callback(null, ["image/jpeg", "image/png", "image/webp"].includes(file.mimetype));
  },
});

router.post(
  "/upload",
  upload.single("image"),
  asyncHandler(async (request, response) => {
    if (!request.file) throw new ApiError(422, "Vui lòng chọn ảnh JPG, PNG hoặc WebP");
    let result;
    if (hasCloudinary) {
      result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          { folder: "icecream-pos/products", resource_type: "image" },
          (error, uploadResult) => (error ? reject(error) : resolve(uploadResult)),
        );
        stream.end(request.file.buffer);
      });
    } else {
      result = {
        secure_url: `${request.protocol}://${request.get("host")}/uploads/${request.file.filename}`,
        public_id: null,
      };
    }
    return created(
      response,
      { url: result.secure_url, publicId: result.public_id },
      "Tải ảnh lên thành công",
    );
  }),
);

export default router;
