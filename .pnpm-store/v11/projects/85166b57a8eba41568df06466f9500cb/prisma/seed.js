import { PrismaClient } from "../src/generated/prisma/index.js";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const roles = [
  { code: "ADMIN", name: "Quản trị viên" },
  { code: "MANAGER", name: "Quản lý cửa hàng" },
  { code: "CASHIER", name: "Thu ngân" },
  { code: "WAREHOUSE", name: "Nhân viên kho" },
  { code: "STAFF", name: "Nhân viên phục vụ" },
];

const permissionCodes = [
  ["dashboard.view", "Xem dashboard", "dashboard"],
  ["pos.use", "Sử dụng POS", "pos"],
  ["orders.view", "Xem đơn hàng", "orders"],
  ["orders.manage", "Quản lý đơn hàng", "orders"],
  ["products.view", "Xem sản phẩm", "products"],
  ["products.manage", "Quản lý sản phẩm", "products"],
  ["customers.view", "Xem khách hàng", "customers"],
  ["customers.manage", "Quản lý khách hàng", "customers"],
  ["inventory.view", "Xem tồn kho", "inventory"],
  ["inventory.manage", "Quản lý tồn kho", "inventory"],
  ["users.manage", "Quản lý nhân viên", "users"],
  ["reports.view", "Xem báo cáo", "reports"],
  ["shifts.manage", "Quản lý ca", "shifts"],
  ["suppliers.manage", "Quản lý nhà cung cấp", "suppliers"],
  ["promotions.manage", "Quản lý khuyến mãi", "promotions"],
];

const categoryNames = [
  "Kem ốc quế",
  "Kem ly",
  "Kem que",
  "Kem hộp",
  "Kem Sundae",
  "Combo",
  "Đồ uống",
  "Topping",
];

const flavorData = [
  ["VANI", "Vani", "#F7E7B7", 0],
  ["CHOCO", "Chocolate", "#8B5E3C", 5000],
  ["DAU", "Dâu", "#FF8FAB", 0],
  ["MATCHA", "Matcha", "#90BE6D", 5000],
  ["SAURIENG", "Sầu riêng", "#F9C74F", 8000],
  ["XOAI", "Xoài", "#F9A826", 3000],
  ["VIETQUAT", "Việt quất", "#6C63A8", 5000],
  ["DUA", "Dừa", "#E9ECEF", 0],
  ["COOKIE", "Cookie", "#A98467", 5000],
  ["BACHA", "Bạc hà", "#7BDCB5", 3000],
  ["CARAMEL", "Caramel", "#D4A373", 5000],
  ["PHOMAI", "Phô mai", "#FFE066", 5000],
];

const toppingNames = [
  "Trân châu",
  "Chocolate chip",
  "Hạnh nhân",
  "Bánh Oreo",
  "Sốt chocolate",
  "Sốt dâu",
  "Kem tươi",
  "Kẹo cốm",
  "Dừa sấy",
  "Đậu phộng",
  "Marshmallow",
  "Bánh quế",
  "Sốt caramel",
  "Thạch trái cây",
  "Cherry",
];

const ingredientNames = [
  ["KEMNEN", "Kem nền", "g"],
  ["SUATUOI", "Sữa tươi", "ml"],
  ["DUONG", "Đường", "g"],
  ["VANI", "Hương vani", "ml"],
  ["CACAO", "Bột cacao", "g"],
  ["DAU", "Dâu tươi", "g"],
  ["MATCHA", "Bột matcha", "g"],
  ["SAURIENG", "Thịt sầu riêng", "g"],
  ["XOAI", "Xoài tươi", "g"],
  ["VIETQUAT", "Việt quất", "g"],
  ["DUA", "Nước cốt dừa", "ml"],
  ["COOKIE", "Bánh cookie", "g"],
  ["BACHA", "Hương bạc hà", "ml"],
  ["CARAMEL", "Sốt caramel", "ml"],
  ["PHOMAI", "Phô mai", "g"],
  ["OCQUE", "Vỏ ốc quế", "cái"],
  ["LYS", "Ly giấy S", "cái"],
  ["LYM", "Ly giấy M", "cái"],
  ["LYL", "Ly giấy L", "cái"],
  ["THIA", "Thìa", "cái"],
  ["TRANCHA", "Trân châu", "g"],
  ["CHOCOCHIP", "Chocolate chip", "g"],
  ["HANHNHAN", "Hạnh nhân", "g"],
  ["OREO", "Bánh Oreo", "g"],
  ["SOTCHOCO", "Sốt chocolate", "ml"],
  ["SOTDAU", "Sốt dâu", "ml"],
  ["KEMTUOI", "Kem tươi", "g"],
  ["ONGHUT", "Ống hút", "cái"],
  ["NAPLY", "Nắp ly", "cái"],
  ["TUI", "Túi giấy", "cái"],
];

const productNames = [
  "Ốc quế cổ điển",
  "Ốc quế chocolate",
  "Ốc quế hạnh nhân",
  "Kem ly vui vẻ",
  "Kem ly cầu vồng",
  "Kem ly nhiệt đới",
  "Kem que vani",
  "Kem que chocolate",
  "Kem que dâu",
  "Kem hộp gia đình",
  "Kem hộp premium",
  "Kem hộp trái cây",
  "Sundae chocolate",
  "Sundae dâu",
  "Sundae caramel",
  "Combo đôi bạn",
  "Combo gia đình",
  "Combo tiệc ngọt",
  "Trà đào",
  "Trà vải",
  "Soda việt quất",
  "Cacao đá",
  "Sữa tươi trân châu",
  "Sinh tố xoài",
  "Ốc quế matcha",
  "Kem ly sầu riêng",
  "Sundae cookie",
  "Combo trẻ em",
  "Kem hộp dừa",
  "Kem ly kim cương",
];

function code(prefix, index) {
  return `${prefix}${String(index + 1).padStart(3, "0")}`;
}

function dateDaysAgo(days, hour = 10) {
  const date = new Date();
  date.setDate(date.getDate() - days);
  date.setHours(hour, 0, 0, 0);
  return date;
}

async function clearDatabase() {
  const operations = [
    prisma.auditLog.deleteMany(),
    prisma.membershipBenefitUsage.deleteMany(),
    prisma.customerVoucher.deleteMany(),
    prisma.stocktakeItem.deleteMany(),
    prisma.stocktake.deleteMany(),
    prisma.stockIssueItem.deleteMany(),
    prisma.stockIssue.deleteMany(),
    prisma.orderStatusHistory.deleteMany(),
    prisma.shiftExpense.deleteMany(),
    prisma.refund.deleteMany(),
    prisma.payment.deleteMany(),
    prisma.promotionUsage.deleteMany(),
    prisma.customerPointTransaction.deleteMany(),
    prisma.orderItemTopping.deleteMany(),
    prisma.orderItemFlavor.deleteMany(),
    prisma.orderItem.deleteMany(),
    prisma.order.deleteMany(),
    prisma.workShift.deleteMany(),
    prisma.membershipSubscription.deleteMany(),
    prisma.promotionProduct.deleteMany(),
    prisma.promotionCategory.deleteMany(),
    prisma.promotion.deleteMany(),
    prisma.inventoryTransaction.deleteMany(),
    prisma.inventoryBatch.deleteMany(),
    prisma.inventory.deleteMany(),
    prisma.purchaseOrderItem.deleteMany(),
    prisma.purchaseOrder.deleteMany(),
    prisma.productRecipe.deleteMany(),
    prisma.membershipPlanProduct.deleteMany(),
    prisma.flavorIngredient.deleteMany(),
    prisma.productImage.deleteMany(),
    prisma.productVariant.deleteMany(),
    prisma.product.deleteMany(),
    prisma.topping.deleteMany(),
    prisma.flavor.deleteMany(),
    prisma.category.deleteMany(),
    prisma.ingredient.deleteMany(),
    prisma.supplier.deleteMany(),
    prisma.customer.deleteMany(),
    prisma.membershipPlan.deleteMany(),
    prisma.membershipLevel.deleteMany(),
    prisma.loginHistory.deleteMany(),
    prisma.refreshToken.deleteMany(),
    prisma.user.deleteMany(),
    prisma.branch.deleteMany(),
    prisma.rolePermission.deleteMany(),
    prisma.permission.deleteMany(),
    prisma.role.deleteMany(),
  ];
  for (const operation of operations) await operation;
}

async function main() {
  const onlyIfEmpty = process.argv.includes("--if-empty");
  if (onlyIfEmpty && (await prisma.user.count()) > 0) {
    console.log("Database đã có dữ liệu, bỏ qua seed.");
    return;
  }

  await clearDatabase();

  const createdPermissions = {};
  for (const [permissionCode, name, module] of permissionCodes) {
    createdPermissions[permissionCode] = await prisma.permission.create({
      data: { code: permissionCode, name, module },
    });
  }

  const createdRoles = {};
  for (const roleData of roles) {
    createdRoles[roleData.code] = await prisma.role.create({ data: roleData });
  }

  const grants = {
    ADMIN: permissionCodes.map(([permissionCode]) => permissionCode),
    MANAGER: permissionCodes
      .map(([permissionCode]) => permissionCode)
      .filter((permissionCode) => permissionCode !== "pos.use"),
    CASHIER: [
      "dashboard.view",
      "pos.use",
      "orders.view",
      "orders.manage",
      "products.view",
      "customers.view",
      "customers.manage",
      "shifts.manage",
    ],
    WAREHOUSE: [
      "dashboard.view",
      "products.view",
      "inventory.view",
      "inventory.manage",
      "suppliers.manage",
    ],
    STAFF: ["dashboard.view", "orders.view", "orders.manage", "products.view"],
  };

  for (const [roleCode, permissionList] of Object.entries(grants)) {
    await prisma.rolePermission.createMany({
      data: permissionList.map((permissionCode) => ({
        roleId: createdRoles[roleCode].id,
        permissionId: createdPermissions[permissionCode].id,
      })),
    });
  }

  const branches = [];
  branches.push(
    await prisma.branch.create({
      data: {
        code: "CN001",
        name: "IceCream POS - Quận 1",
        address: "123 Nguyễn Huệ, Quận 1, TP.HCM",
        phone: "028 3822 6688",
        openingHours: "08:00 - 22:30",
      },
    }),
  );
  branches.push(
    await prisma.branch.create({
      data: {
        code: "CN002",
        name: "IceCream POS - Thủ Đức",
        address: "45 Võ Văn Ngân, TP. Thủ Đức, TP.HCM",
        phone: "028 3722 8899",
        openingHours: "09:00 - 23:00",
      },
    }),
  );

  const passwordHash = await bcrypt.hash("IceCream@123", 12);
  const userSpecs = [
    ["admin", "admin@icecream.vn", "Nguyễn Minh Anh", "ADMIN", 0],
    ["manager", "manager@icecream.vn", "Trần Thu Hà", "MANAGER", 0],
    ["cashier", "cashier@icecream.vn", "Lê Hoàng Nam", "CASHIER", 0],
    ["warehouse", "warehouse@icecream.vn", "Phạm Quốc Huy", "WAREHOUSE", 0],
    ["staff01", "staff01@icecream.vn", "Võ Thùy Linh", "STAFF", 0],
    ["cashier02", "cashier02@icecream.vn", "Đỗ Gia Bảo", "CASHIER", 1],
    ["manager02", "manager02@icecream.vn", "Bùi Thanh Tâm", "MANAGER", 1],
    ["warehouse02", "warehouse02@icecream.vn", "Ngô Đức Long", "WAREHOUSE", 1],
    ["staff02", "staff02@icecream.vn", "Mai Khánh Vy", "STAFF", 1],
    ["staff03", "staff03@icecream.vn", "Đặng Tuấn Kiệt", "STAFF", 0],
  ];

  const users = [];
  for (let index = 0; index < userSpecs.length; index += 1) {
    const [username, email, fullName, roleCode, branchIndex] = userSpecs[index];
    users.push(
      await prisma.user.create({
        data: {
          username,
          email,
          fullName,
          phone: `090${String(1000000 + index).padStart(7, "0")}`,
          passwordHash,
          roleId: createdRoles[roleCode].id,
          branchId: branches[branchIndex].id,
          lastLoginAt: index < 4 ? new Date() : null,
        },
      }),
    );
  }

  await prisma.branch.update({
    where: { id: branches[0].id },
    data: { managerId: users[1].id },
  });
  await prisma.branch.update({
    where: { id: branches[1].id },
    data: { managerId: users[6].id },
  });

  const categories = [];
  for (let index = 0; index < categoryNames.length; index += 1) {
    categories.push(
      await prisma.category.create({
        data: {
          code: code("DM", index),
          name: categoryNames[index],
          displayOrder: index + 1,
        },
      }),
    );
  }

  const suppliers = [];
  for (let index = 0; index < 5; index += 1) {
    suppliers.push(
      await prisma.supplier.create({
        data: {
          code: code("NCC", index),
          name: [
            "Nguyên liệu Ngọt Việt",
            "Sữa Cao Nguyên",
            "Bao bì Xanh",
            "Trái cây Miền Nam",
            "Topping House",
          ][index],
          contactPerson: `Đối tác ${index + 1}`,
          phone: `0283900${String(index + 1).padStart(4, "0")}`,
          email: `supplier${index + 1}@example.vn`,
          address: `Kho ${index + 1}, TP.HCM`,
        },
      }),
    );
  }

  const ingredients = [];
  for (let index = 0; index < ingredientNames.length; index += 1) {
    const [ingredientCode, name, unit] = ingredientNames[index];
    ingredients.push(
      await prisma.ingredient.create({
        data: {
          code: `NL-${ingredientCode}`,
          name,
          unit,
          minStock: unit === "cái" ? 40 : 2000,
          lastCost: unit === "cái" ? 800 : 120,
          averageCost: unit === "cái" ? 750 : 110,
          supplierId: suppliers[index % suppliers.length].id,
          defaultExpiryDays: index < 15 ? 30 : 365,
          warehouseLocation: `Kệ ${String.fromCharCode(65 + (index % 6))}-${(index % 5) + 1}`,
        },
      }),
    );
  }

  for (const branch of branches) {
    for (let index = 0; index < ingredients.length; index += 1) {
      const quantity = ingredientNames[index][2] === "cái" ? 400 + index * 7 : 12000 + index * 250;
      await prisma.inventory.create({
        data: { branchId: branch.id, ingredientId: ingredients[index].id, quantity },
      });
      await prisma.inventoryBatch.create({
        data: {
          branchId: branch.id,
          ingredientId: ingredients[index].id,
          batchNumber: `${branch.code}-LO${String(index + 1).padStart(3, "0")}`,
          manufactureDate: dateDaysAgo(5 + (index % 10)),
          expiryDate: new Date(Date.now() + (8 + (index % 80)) * 86400000),
          quantity,
          remaining: quantity,
          unitCost: ingredients[index].averageCost,
        },
      });
    }
  }

  const flavors = [];
  for (let index = 0; index < flavorData.length; index += 1) {
    const [flavorCode, name, color, extraPrice] = flavorData[index];
    flavors.push(
      await prisma.flavor.create({
        data: { code: `HV-${flavorCode}`, name, color, extraPrice },
      }),
    );
    await prisma.flavorIngredient.create({
      data: {
        flavorId: flavors[index].id,
        ingredientId: ingredients[index + 3].id,
        quantity: index === 0 ? 2 : 10,
      },
    });
    await prisma.productRecipe.create({
      data: {
        flavorId: flavors[index].id,
        ingredientId: ingredients[0].id,
        quantity: 70,
        note: "Một viên kem",
      },
    });
  }

  const toppings = [];
  for (let index = 0; index < toppingNames.length; index += 1) {
    toppings.push(
      await prisma.topping.create({
        data: {
          code: code("TP", index),
          name: toppingNames[index],
          price: 7000 + (index % 4) * 3000,
          costPrice: 2500 + (index % 4) * 1000,
        },
      }),
    );
    await prisma.productRecipe.create({
      data: {
        toppingId: toppings[index].id,
        ingredientId: ingredients[20 + (index % 7)].id,
        quantity: 15,
        note: "Một phần topping",
      },
    });
  }

  const products = [];
  const variants = [];
  for (let index = 0; index < productNames.length; index += 1) {
    const categoryIndex =
      index < 3 ? 0 : index < 6 ? 1 : index < 9 ? 2 : index < 12 ? 3 : index < 15 ? 4 : index < 18 ? 5 : index < 24 ? 6 : index < 29 ? index % 6 : 1;
    const basePrice = 29000 + (index % 8) * 5000;
    const product = await prisma.product.create({
      data: {
        code: code("SP", index),
        name: productNames[index],
        categoryId: categories[categoryIndex].id,
        description: `Món ${productNames[index].toLowerCase()} được làm mới mỗi ngày từ nguyên liệu chọn lọc.`,
        price: basePrice,
        costPrice: Math.round(basePrice * 0.42),
        isFeatured: index < 8,
        displayOrder: index + 1,
      },
    });
    products.push(product);

    const variantSpecs =
      categoryIndex <= 1 || categoryIndex === 4
        ? [
            ["S", "S", 1, basePrice],
            ["M", "M", 2, basePrice + 15000],
            ["L", "L", 3, basePrice + 28000],
          ]
        : [["Tiêu chuẩn", null, categoryIndex === 3 ? 6 : 1, basePrice]];

    for (let variantIndex = 0; variantIndex < variantSpecs.length; variantIndex += 1) {
      const [name, size, scoopCount, price] = variantSpecs[variantIndex];
      const variant = await prisma.productVariant.create({
        data: {
          productId: product.id,
          sku: `${product.code}-${size || "STD"}`,
          name,
          size,
          cupType: categoryIndex === 0 ? "Ốc quế" : categoryIndex === 1 || categoryIndex === 4 ? "Ly giấy" : null,
          scoopCount,
          price,
          costPrice: Math.round(price * 0.42),
        },
      });
      variants.push(variant);
      const packagingIndex = categoryIndex === 0 ? 15 : size === "S" ? 16 : size === "L" ? 18 : 17;
      await prisma.productRecipe.create({
        data: {
          variantId: variant.id,
          ingredientId: ingredients[packagingIndex].id,
          quantity: 1,
          note: "Bao bì chính",
        },
      });
      if ([0, 1, 4].includes(categoryIndex)) {
        await prisma.productRecipe.create({
          data: {
            variantId: variant.id,
            ingredientId: ingredients[19].id,
            quantity: 1,
            note: "Thìa dùng kèm",
          },
        });
      }
    }
  }

  const monthlyMembershipPlan = await prisma.membershipPlan.create({
    data: {
      code: "HOIVIEN30",
      name: "Hội viên Kem Mỗi Ngày",
      description: "Hiệu lực 30 ngày, mỗi ngày được miễn phí 1 sản phẩm kem đủ điều kiện.",
      price: 399000,
      durationDays: 30,
      dailyFreeQuantity: 1,
      benefitVariantId: variants[0].id,
      products: {
        create: [{ productId: products[0].id }],
      },
    },
  });

  const memberships = [];
  for (const [
    memberCode,
    name,
    minSpending,
    minPoints,
    pointRate,
    birthdayDiscount,
    displayOrder,
    voucherEnabled,
    voucherValue,
  ] of [
    ["NEW", "Thành viên mới", 0, 0, 1, 5, 1, false, 0],
    ["SILVER", "Bạc", 1000000, 100, 1.5, 10, 2, true, 30000],
    ["GOLD", "Vàng", 5000000, 700, 2, 15, 3, true, 50000],
    ["DIAMOND", "Kim cương", 15000000, 2700, 3, 20, 4, true, 100000],
  ]) {
    memberships.push(
      await prisma.membershipLevel.create({
        data: {
          code: memberCode,
          name,
          minSpending,
          minPoints,
          pointRate,
          birthdayDiscount,
          displayOrder,
          voucherEnabled,
          voucherType: "FIXED_AMOUNT",
          voucherValue,
          voucherValidityDays: 15,
          voucherCooldownDays: 15,
          voucherRenewalOrderMinAmount: 200000,
        },
      }),
    );
  }

  const customers = [];
  for (let index = 0; index < 50; index += 1) {
    const levelIndex = index > 45 ? 3 : index > 35 ? 2 : index > 20 ? 1 : 0;
    customers.push(
      await prisma.customer.create({
        data: {
          code: code("KH", index),
          fullName: `Khách hàng ${String(index + 1).padStart(2, "0")}`,
          phone: `091${String(2000000 + index).padStart(7, "0")}`,
          email: `customer${index + 1}@example.vn`,
          dateOfBirth: new Date(1985 + (index % 20), index % 12, (index % 27) + 1),
          address: `${index + 10} đường Hoa Kem, TP.HCM`,
          membershipLevelId: memberships[levelIndex].id,
          totalSpending: memberships[levelIndex].minSpending + index * 50000,
          totalOrders: 1 + (index % 20),
          points: memberships[levelIndex].minPoints + 20 + index * 3,
        },
      }),
    );
  }

  const now = new Date();
  await prisma.membershipSubscription.create({
    data: {
      code: "HV-DEMO-001",
      customerId: customers[0].id,
      membershipPlanId: monthlyMembershipPlan.id,
      branchId: branches[0].id,
      createdById: users[2].id,
      startsAt: new Date(now.getTime() - 2 * 86400000),
      endsAt: new Date(now.getTime() + 28 * 86400000),
      amountPaid: monthlyMembershipPlan.price,
      paymentMethod: "CASH",
      note: "Gói hội viên mẫu",
    },
  });

  const promo = await prisma.promotion.create({
    data: {
      code: "MUAHE10",
      name: "Mùa hè ngọt ngào",
      description: "Giảm 10% tối đa 50.000đ cho đơn từ 100.000đ",
      type: "PERCENT",
      value: 10,
      startAt: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      endAt: new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59),
      minOrderValue: 100000,
      maxDiscount: 50000,
      totalUsageLimit: 1000,
      usagePerCustomer: 3,
    },
  });
  await prisma.promotion.create({
    data: {
      code: "HAPPY20K",
      name: "Giờ vàng",
      description: "Giảm 20.000đ trong khung giờ 14h - 17h",
      type: "HAPPY_HOUR",
      value: 20000,
      startAt: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      endAt: new Date(now.getFullYear(), now.getMonth() + 2, 0, 23, 59, 59),
      minOrderValue: 80000,
      startHour: 14,
      endHour: 17,
      totalUsageLimit: 500,
      usagePerCustomer: 2,
    },
  });
  await prisma.promotion.create({
    data: {
      code: "MUA3TANG1",
      name: "Mua 3 tặng 1",
      description: "Chọn 4 món kem bất kỳ, món có giá thấp nhất được miễn phí",
      type: "BUY_X_GET_Y",
      value: 0,
      buyQuantity: 3,
      getQuantity: 1,
      startAt: new Date(now.getFullYear(), now.getMonth() - 1, 1),
      endAt: new Date(now.getFullYear() + 3, 11, 31, 23, 59, 59),
      minOrderValue: 0,
      totalUsageLimit: 5000,
      usagePerCustomer: 50,
    },
  });

  const shift = await prisma.workShift.create({
    data: {
      code: `CA-${branches[0].code}-${now.toISOString().slice(0, 10).replaceAll("-", "")}-01`,
      branchId: branches[0].id,
      userId: users[2].id,
      openingCash: 1000000,
      status: "OPEN",
    },
  });

  for (let index = 0; index < 100; index += 1) {
    const createdAt = dateDaysAgo(index % 45, 9 + (index % 12));
    const product = products[index % products.length];
    const variant = await prisma.productVariant.findFirst({
      where: { productId: product.id },
      orderBy: { price: "asc" },
    });
    const quantity = 1 + (index % 3);
    const topping = toppings[index % toppings.length];
    const flavor = flavors[index % flavors.length];
    const originalAmount = (variant.price + flavor.extraPrice + topping.price) * quantity;
    const discountAmount = index % 4 === 0 ? Math.min(Math.round(originalAmount * 0.1), 50000) : 0;
    const taxAmount = Math.round((originalAmount - discountAmount) * 0.08);
    const totalAmount = originalAmount - discountAmount + taxAmount;
    const orderCode = `HD${createdAt.toISOString().slice(0, 10).replaceAll("-", "")}${String(index + 1).padStart(4, "0")}`;
    const customer = customers[index % customers.length];
    const branch = branches[index % branches.length];
    const creator = index % branches.length === 0 ? users[2] : users[5];
    const order = await prisma.order.create({
      data: {
        code: orderCode,
        branchId: branch.id,
        customerId: customer.id,
        createdById: creator.id,
        shiftId: index < 4 && branch.id === branches[0].id ? shift.id : null,
        promotionId: index % 4 === 0 ? promo.id : null,
        originalAmount,
        discountAmount,
        vatRate: 8,
        taxAmount,
        totalAmount,
        customerPaid: totalAmount,
        changeAmount: 0,
        paymentStatus: "PAID",
        status: index % 17 === 0 ? "CANCELLED" : "COMPLETED",
        cancellationReason: index % 17 === 0 ? "Khách thay đổi nhu cầu" : null,
        completedAt: index % 17 === 0 ? null : createdAt,
        cancelledAt: index % 17 === 0 ? createdAt : null,
        createdAt,
        updatedAt: createdAt,
        items: {
          create: {
            productId: product.id,
            variantId: variant.id,
            productName: product.name,
            variantName: variant.name,
            sku: variant.sku,
            unitPrice: variant.price,
            quantity,
            scoopCount: variant.scoopCount,
            lineTotal: originalAmount,
            flavors: {
              create: {
                flavorId: flavor.id,
                scoopNumber: 1,
                extraPrice: flavor.extraPrice,
              },
            },
            toppings: {
              create: {
                toppingId: topping.id,
                quantity: 1,
                price: topping.price,
              },
            },
          },
        },
        payments: {
          create: {
            code: `TT${String(index + 1).padStart(6, "0")}`,
            method: ["CASH", "BANK_TRANSFER", "CARD", "EWALLET"][index % 4],
            amount: totalAmount,
            paidAt: createdAt,
            createdAt,
            updatedAt: createdAt,
          },
        },
        statusHistory: {
          create: [
            { status: "PENDING", changedById: creator.id, createdAt },
            {
              status: index % 17 === 0 ? "CANCELLED" : "COMPLETED",
              changedById: creator.id,
              createdAt,
            },
          ],
        },
      },
    });

    if (index % 4 === 0) {
      await prisma.promotionUsage.create({
        data: {
          promotionId: promo.id,
          customerId: customer.id,
          orderId: order.id,
          discount: discountAmount,
          createdAt,
        },
      });
    }
  }

  await prisma.workShift.update({
    where: { id: shift.id },
    data: {
      cashRevenue: await prisma.payment
        .aggregate({
          where: { order: { shiftId: shift.id }, method: "CASH" },
          _sum: { amount: true },
        })
        .then((result) => result._sum.amount || 0),
    },
  });

  console.log("Seed IceCream POS hoàn tất:");
  console.log("- 2 chi nhánh, 10 nhân viên, 30 sản phẩm");
  console.log("- 12 hương vị, 15 topping, 30 nguyên liệu");
  console.log("- 50 khách hàng, 100 đơn hàng và dữ liệu kho theo lô");
}

main()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
