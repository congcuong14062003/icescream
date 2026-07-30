-- CreateTable
CREATE TABLE "Role" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Permission" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "module" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "RolePermission" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    PRIMARY KEY ("roleId", "permissionId"),
    CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "RolePermission_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "Permission" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Branch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "openingHours" TEXT,
    "managerId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Branch_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "User" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "username" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "passwordHash" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT,
    "avatarUrl" TEXT,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "roleId" TEXT NOT NULL,
    "branchId" TEXT,
    "lastLoginAt" DATETIME,
    "passwordResetHash" TEXT,
    "passwordResetExpires" DATETIME,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "User_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "User_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "RefreshToken" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "userAgent" TEXT,
    "ipAddress" TEXT,
    "expiresAt" DATETIME NOT NULL,
    "revokedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "RefreshToken_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "LoginHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT NOT NULL,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "success" BOOLEAN NOT NULL,
    "reason" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "LoginHistory_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Category" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Product" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "description" TEXT,
    "imageUrl" TEXT,
    "price" INTEGER NOT NULL,
    "costPrice" INTEGER NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'ACTIVE',
    "isFeatured" BOOLEAN NOT NULL DEFAULT false,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Product_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductImage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "publicId" TEXT,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductImage_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductVariant" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT NOT NULL,
    "sku" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "size" TEXT,
    "cupType" TEXT,
    "scoopCount" INTEGER NOT NULL DEFAULT 1,
    "price" INTEGER NOT NULL,
    "costPrice" INTEGER NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductVariant_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Flavor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "imageUrl" TEXT,
    "extraPrice" INTEGER NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "FlavorIngredient" (
    "flavorId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantity" REAL NOT NULL,

    PRIMARY KEY ("flavorId", "ingredientId"),
    CONSTRAINT "FlavorIngredient_flavorId_fkey" FOREIGN KEY ("flavorId") REFERENCES "Flavor" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "FlavorIngredient_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Topping" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "imageUrl" TEXT,
    "price" INTEGER NOT NULL,
    "costPrice" INTEGER NOT NULL,
    "stockStatus" TEXT NOT NULL DEFAULT 'AVAILABLE',
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Ingredient" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL,
    "minStock" REAL NOT NULL DEFAULT 0,
    "lastCost" INTEGER NOT NULL DEFAULT 0,
    "averageCost" INTEGER NOT NULL DEFAULT 0,
    "supplierId" TEXT,
    "defaultExpiryDays" INTEGER,
    "warehouseLocation" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Ingredient_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ProductRecipe" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "productId" TEXT,
    "variantId" TEXT,
    "flavorId" TEXT,
    "toppingId" TEXT,
    "ingredientId" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ProductRecipe_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProductRecipe_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProductRecipe_flavorId_fkey" FOREIGN KEY ("flavorId") REFERENCES "Flavor" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProductRecipe_toppingId_fkey" FOREIGN KEY ("toppingId") REFERENCES "Topping" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ProductRecipe_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Inventory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branchId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantity" REAL NOT NULL DEFAULT 0,
    "reserved" REAL NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Inventory_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Inventory_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryBatch" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "branchId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "purchaseItemId" TEXT,
    "batchNumber" TEXT NOT NULL,
    "manufactureDate" DATETIME,
    "expiryDate" DATETIME,
    "quantity" REAL NOT NULL,
    "remaining" REAL NOT NULL,
    "unitCost" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InventoryBatch_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryBatch_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryBatch_purchaseItemId_fkey" FOREIGN KEY ("purchaseItemId") REFERENCES "PurchaseOrderItem" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "InventoryTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "fromBranchId" TEXT,
    "toBranchId" TEXT,
    "ingredientId" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "balanceAfter" REAL NOT NULL,
    "unitCost" INTEGER,
    "referenceType" TEXT,
    "referenceId" TEXT,
    "note" TEXT,
    "createdById" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "InventoryTransaction_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryTransaction_fromBranchId_fkey" FOREIGN KEY ("fromBranchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InventoryTransaction_toBranchId_fkey" FOREIGN KEY ("toBranchId") REFERENCES "Branch" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "InventoryTransaction_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "InventoryTransaction_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Supplier" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "contactPerson" TEXT,
    "phone" TEXT,
    "email" TEXT,
    "address" TEXT,
    "outstandingDebt" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PurchaseOrder" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "supplierId" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'DRAFT',
    "totalAmount" INTEGER NOT NULL DEFAULT 0,
    "note" TEXT,
    "approvedAt" DATETIME,
    "receivedAt" DATETIME,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PurchaseOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrder_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrder_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PurchaseOrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "purchaseOrderId" TEXT NOT NULL,
    "ingredientId" TEXT NOT NULL,
    "quantity" REAL NOT NULL,
    "unitCost" INTEGER NOT NULL,
    "lineTotal" INTEGER NOT NULL,
    "batchNumber" TEXT,
    "manufactureDate" DATETIME,
    "expiryDate" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "PurchaseOrderItem_purchaseOrderId_fkey" FOREIGN KEY ("purchaseOrderId") REFERENCES "PurchaseOrder" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PurchaseOrderItem_ingredientId_fkey" FOREIGN KEY ("ingredientId") REFERENCES "Ingredient" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "MembershipLevel" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "minSpending" INTEGER NOT NULL,
    "pointRate" REAL NOT NULL,
    "pointValue" INTEGER NOT NULL DEFAULT 1000,
    "birthdayDiscount" INTEGER NOT NULL DEFAULT 0,
    "displayOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "Customer" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "fullName" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "email" TEXT,
    "dateOfBirth" DATETIME,
    "address" TEXT,
    "membershipLevelId" TEXT NOT NULL,
    "totalSpending" INTEGER NOT NULL DEFAULT 0,
    "totalOrders" INTEGER NOT NULL DEFAULT 0,
    "points" INTEGER NOT NULL DEFAULT 0,
    "deletedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Customer_membershipLevelId_fkey" FOREIGN KEY ("membershipLevelId") REFERENCES "MembershipLevel" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "CustomerPointTransaction" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "customerId" TEXT NOT NULL,
    "orderId" TEXT,
    "type" TEXT NOT NULL,
    "points" INTEGER NOT NULL,
    "balanceAfter" INTEGER NOT NULL,
    "description" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "CustomerPointTransaction_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "CustomerPointTransaction_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Promotion" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "type" TEXT NOT NULL,
    "value" INTEGER NOT NULL,
    "startAt" DATETIME NOT NULL,
    "endAt" DATETIME NOT NULL,
    "minOrderValue" INTEGER NOT NULL DEFAULT 0,
    "maxDiscount" INTEGER,
    "totalUsageLimit" INTEGER,
    "usagePerCustomer" INTEGER NOT NULL DEFAULT 1,
    "buyQuantity" INTEGER,
    "getQuantity" INTEGER,
    "startHour" INTEGER,
    "endHour" INTEGER,
    "memberOnly" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL
);

-- CreateTable
CREATE TABLE "PromotionProduct" (
    "promotionId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,

    PRIMARY KEY ("promotionId", "productId"),
    CONSTRAINT "PromotionProduct_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PromotionProduct_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PromotionCategory" (
    "promotionId" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,

    PRIMARY KEY ("promotionId", "categoryId"),
    CONSTRAINT "PromotionCategory_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "PromotionCategory_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "Category" ("id") ON DELETE CASCADE ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "PromotionUsage" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "promotionId" TEXT NOT NULL,
    "customerId" TEXT,
    "orderId" TEXT NOT NULL,
    "discount" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "PromotionUsage_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "PromotionUsage_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "PromotionUsage_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Order" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "customerId" TEXT,
    "createdById" TEXT NOT NULL,
    "assignedToId" TEXT,
    "shiftId" TEXT,
    "promotionId" TEXT,
    "originalAmount" INTEGER NOT NULL,
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "pointsDiscount" INTEGER NOT NULL DEFAULT 0,
    "vatRate" REAL NOT NULL DEFAULT 0,
    "taxAmount" INTEGER NOT NULL DEFAULT 0,
    "deliveryFee" INTEGER NOT NULL DEFAULT 0,
    "totalAmount" INTEGER NOT NULL,
    "customerPaid" INTEGER NOT NULL DEFAULT 0,
    "changeAmount" INTEGER NOT NULL DEFAULT 0,
    "paymentStatus" TEXT NOT NULL DEFAULT 'UNPAID',
    "status" TEXT NOT NULL DEFAULT 'PENDING',
    "note" TEXT,
    "cancellationReason" TEXT,
    "completedAt" DATETIME,
    "cancelledAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Order_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_customerId_fkey" FOREIGN KEY ("customerId") REFERENCES "Customer" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Order_assignedToId_fkey" FOREIGN KEY ("assignedToId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "WorkShift" ("id") ON DELETE SET NULL ON UPDATE CASCADE,
    CONSTRAINT "Order_promotionId_fkey" FOREIGN KEY ("promotionId") REFERENCES "Promotion" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderItem" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "productId" TEXT NOT NULL,
    "variantId" TEXT,
    "productName" TEXT NOT NULL,
    "variantName" TEXT,
    "sku" TEXT NOT NULL,
    "unitPrice" INTEGER NOT NULL,
    "quantity" INTEGER NOT NULL,
    "scoopCount" INTEGER NOT NULL DEFAULT 0,
    "discountAmount" INTEGER NOT NULL DEFAULT 0,
    "lineTotal" INTEGER NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "OrderItem_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderItem_productId_fkey" FOREIGN KEY ("productId") REFERENCES "Product" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "OrderItem_variantId_fkey" FOREIGN KEY ("variantId") REFERENCES "ProductVariant" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderItemFlavor" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderItemId" TEXT NOT NULL,
    "flavorId" TEXT NOT NULL,
    "scoopNumber" INTEGER NOT NULL,
    "extraPrice" INTEGER NOT NULL DEFAULT 0,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderItemFlavor_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderItemFlavor_flavorId_fkey" FOREIGN KEY ("flavorId") REFERENCES "Flavor" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderItemTopping" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderItemId" TEXT NOT NULL,
    "toppingId" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "price" INTEGER NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderItemTopping_orderItemId_fkey" FOREIGN KEY ("orderItemId") REFERENCES "OrderItem" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderItemTopping_toppingId_fkey" FOREIGN KEY ("toppingId") REFERENCES "Topping" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Payment" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "method" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "referenceCode" TEXT,
    "note" TEXT,
    "paidAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Payment_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "Refund" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "orderId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "method" TEXT NOT NULL,
    "reason" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'COMPLETED',
    "refundedAt" DATETIME,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "Refund_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "Refund_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "WorkShift" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "code" TEXT NOT NULL,
    "branchId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'OPEN',
    "openingCash" INTEGER NOT NULL,
    "cashRevenue" INTEGER NOT NULL DEFAULT 0,
    "transferRevenue" INTEGER NOT NULL DEFAULT 0,
    "cardRevenue" INTEGER NOT NULL DEFAULT 0,
    "ewalletRevenue" INTEGER NOT NULL DEFAULT 0,
    "refundAmount" INTEGER NOT NULL DEFAULT 0,
    "expenseAmount" INTEGER NOT NULL DEFAULT 0,
    "expectedCash" INTEGER,
    "countedCash" INTEGER,
    "difference" INTEGER,
    "openedAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "closedAt" DATETIME,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "WorkShift_branchId_fkey" FOREIGN KEY ("branchId") REFERENCES "Branch" ("id") ON DELETE RESTRICT ON UPDATE CASCADE,
    CONSTRAINT "WorkShift_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "ShiftExpense" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "shiftId" TEXT NOT NULL,
    "createdById" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "amount" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" DATETIME NOT NULL,
    CONSTRAINT "ShiftExpense_shiftId_fkey" FOREIGN KEY ("shiftId") REFERENCES "WorkShift" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "ShiftExpense_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "OrderStatusHistory" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "orderId" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "changedById" TEXT NOT NULL,
    "note" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "OrderStatusHistory_orderId_fkey" FOREIGN KEY ("orderId") REFERENCES "Order" ("id") ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT "OrderStatusHistory_changedById_fkey" FOREIGN KEY ("changedById") REFERENCES "User" ("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

-- CreateTable
CREATE TABLE "AuditLog" (
    "id" TEXT NOT NULL PRIMARY KEY,
    "userId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "oldData" JSONB,
    "newData" JSONB,
    "ipAddress" TEXT,
    "userAgent" TEXT,
    "createdAt" DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "AuditLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User" ("id") ON DELETE SET NULL ON UPDATE CASCADE
);

-- CreateIndex
CREATE UNIQUE INDEX "Role_code_key" ON "Role"("code");

-- CreateIndex
CREATE INDEX "Role_name_idx" ON "Role"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Permission_code_key" ON "Permission"("code");

-- CreateIndex
CREATE INDEX "Permission_module_code_idx" ON "Permission"("module", "code");

-- CreateIndex
CREATE UNIQUE INDEX "Branch_code_key" ON "Branch"("code");

-- CreateIndex
CREATE INDEX "Branch_name_idx" ON "Branch"("name");

-- CreateIndex
CREATE INDEX "Branch_isActive_createdAt_idx" ON "Branch"("isActive", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "User_username_key" ON "User"("username");

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "User_fullName_idx" ON "User"("fullName");

-- CreateIndex
CREATE INDEX "User_status_createdAt_idx" ON "User"("status", "createdAt");

-- CreateIndex
CREATE INDEX "User_branchId_roleId_idx" ON "User"("branchId", "roleId");

-- CreateIndex
CREATE UNIQUE INDEX "RefreshToken_tokenHash_key" ON "RefreshToken"("tokenHash");

-- CreateIndex
CREATE INDEX "RefreshToken_userId_expiresAt_idx" ON "RefreshToken"("userId", "expiresAt");

-- CreateIndex
CREATE INDEX "LoginHistory_userId_createdAt_idx" ON "LoginHistory"("userId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Category_code_key" ON "Category"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Category_name_key" ON "Category"("name");

-- CreateIndex
CREATE INDEX "Category_name_idx" ON "Category"("name");

-- CreateIndex
CREATE INDEX "Category_isActive_displayOrder_idx" ON "Category"("isActive", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "Product_code_key" ON "Product"("code");

-- CreateIndex
CREATE INDEX "Product_name_idx" ON "Product"("name");

-- CreateIndex
CREATE INDEX "Product_status_createdAt_idx" ON "Product"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Product_categoryId_status_displayOrder_idx" ON "Product"("categoryId", "status", "displayOrder");

-- CreateIndex
CREATE INDEX "ProductImage_productId_displayOrder_idx" ON "ProductImage"("productId", "displayOrder");

-- CreateIndex
CREATE UNIQUE INDEX "ProductVariant_sku_key" ON "ProductVariant"("sku");

-- CreateIndex
CREATE INDEX "ProductVariant_productId_isActive_idx" ON "ProductVariant"("productId", "isActive");

-- CreateIndex
CREATE INDEX "ProductVariant_name_idx" ON "ProductVariant"("name");

-- CreateIndex
CREATE UNIQUE INDEX "Flavor_code_key" ON "Flavor"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Flavor_name_key" ON "Flavor"("name");

-- CreateIndex
CREATE INDEX "Flavor_name_idx" ON "Flavor"("name");

-- CreateIndex
CREATE INDEX "Flavor_status_createdAt_idx" ON "Flavor"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Topping_code_key" ON "Topping"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Topping_name_key" ON "Topping"("name");

-- CreateIndex
CREATE INDEX "Topping_name_idx" ON "Topping"("name");

-- CreateIndex
CREATE INDEX "Topping_stockStatus_createdAt_idx" ON "Topping"("stockStatus", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Ingredient_code_key" ON "Ingredient"("code");

-- CreateIndex
CREATE INDEX "Ingredient_name_idx" ON "Ingredient"("name");

-- CreateIndex
CREATE INDEX "Ingredient_isActive_createdAt_idx" ON "Ingredient"("isActive", "createdAt");

-- CreateIndex
CREATE INDEX "ProductRecipe_productId_idx" ON "ProductRecipe"("productId");

-- CreateIndex
CREATE INDEX "ProductRecipe_variantId_idx" ON "ProductRecipe"("variantId");

-- CreateIndex
CREATE INDEX "ProductRecipe_flavorId_idx" ON "ProductRecipe"("flavorId");

-- CreateIndex
CREATE INDEX "ProductRecipe_toppingId_idx" ON "ProductRecipe"("toppingId");

-- CreateIndex
CREATE INDEX "ProductRecipe_ingredientId_idx" ON "ProductRecipe"("ingredientId");

-- CreateIndex
CREATE INDEX "Inventory_quantity_idx" ON "Inventory"("quantity");

-- CreateIndex
CREATE UNIQUE INDEX "Inventory_branchId_ingredientId_key" ON "Inventory"("branchId", "ingredientId");

-- CreateIndex
CREATE INDEX "InventoryBatch_expiryDate_remaining_idx" ON "InventoryBatch"("expiryDate", "remaining");

-- CreateIndex
CREATE INDEX "InventoryBatch_branchId_ingredientId_idx" ON "InventoryBatch"("branchId", "ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryBatch_branchId_ingredientId_batchNumber_key" ON "InventoryBatch"("branchId", "ingredientId", "batchNumber");

-- CreateIndex
CREATE UNIQUE INDEX "InventoryTransaction_code_key" ON "InventoryTransaction"("code");

-- CreateIndex
CREATE INDEX "InventoryTransaction_branchId_ingredientId_createdAt_idx" ON "InventoryTransaction"("branchId", "ingredientId", "createdAt");

-- CreateIndex
CREATE INDEX "InventoryTransaction_type_createdAt_idx" ON "InventoryTransaction"("type", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Supplier_code_key" ON "Supplier"("code");

-- CreateIndex
CREATE INDEX "Supplier_name_idx" ON "Supplier"("name");

-- CreateIndex
CREATE INDEX "Supplier_isActive_createdAt_idx" ON "Supplier"("isActive", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "PurchaseOrder_code_key" ON "PurchaseOrder"("code");

-- CreateIndex
CREATE INDEX "PurchaseOrder_status_createdAt_idx" ON "PurchaseOrder"("status", "createdAt");

-- CreateIndex
CREATE INDEX "PurchaseOrder_branchId_createdAt_idx" ON "PurchaseOrder"("branchId", "createdAt");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_purchaseOrderId_idx" ON "PurchaseOrderItem"("purchaseOrderId");

-- CreateIndex
CREATE INDEX "PurchaseOrderItem_ingredientId_idx" ON "PurchaseOrderItem"("ingredientId");

-- CreateIndex
CREATE UNIQUE INDEX "MembershipLevel_code_key" ON "MembershipLevel"("code");

-- CreateIndex
CREATE INDEX "MembershipLevel_minSpending_idx" ON "MembershipLevel"("minSpending");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_code_key" ON "Customer"("code");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_phone_key" ON "Customer"("phone");

-- CreateIndex
CREATE UNIQUE INDEX "Customer_email_key" ON "Customer"("email");

-- CreateIndex
CREATE INDEX "Customer_fullName_idx" ON "Customer"("fullName");

-- CreateIndex
CREATE INDEX "Customer_phone_idx" ON "Customer"("phone");

-- CreateIndex
CREATE INDEX "Customer_createdAt_idx" ON "Customer"("createdAt");

-- CreateIndex
CREATE INDEX "CustomerPointTransaction_customerId_createdAt_idx" ON "CustomerPointTransaction"("customerId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "Promotion_code_key" ON "Promotion"("code");

-- CreateIndex
CREATE INDEX "Promotion_isActive_startAt_endAt_idx" ON "Promotion"("isActive", "startAt", "endAt");

-- CreateIndex
CREATE INDEX "Promotion_name_idx" ON "Promotion"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PromotionUsage_orderId_key" ON "PromotionUsage"("orderId");

-- CreateIndex
CREATE INDEX "PromotionUsage_promotionId_createdAt_idx" ON "PromotionUsage"("promotionId", "createdAt");

-- CreateIndex
CREATE INDEX "PromotionUsage_customerId_promotionId_idx" ON "PromotionUsage"("customerId", "promotionId");

-- CreateIndex
CREATE UNIQUE INDEX "Order_code_key" ON "Order"("code");

-- CreateIndex
CREATE INDEX "Order_status_createdAt_idx" ON "Order"("status", "createdAt");

-- CreateIndex
CREATE INDEX "Order_paymentStatus_createdAt_idx" ON "Order"("paymentStatus", "createdAt");

-- CreateIndex
CREATE INDEX "Order_branchId_createdAt_idx" ON "Order"("branchId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_customerId_createdAt_idx" ON "Order"("customerId", "createdAt");

-- CreateIndex
CREATE INDEX "Order_createdById_createdAt_idx" ON "Order"("createdById", "createdAt");

-- CreateIndex
CREATE INDEX "OrderItem_orderId_idx" ON "OrderItem"("orderId");

-- CreateIndex
CREATE INDEX "OrderItem_productId_createdAt_idx" ON "OrderItem"("productId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderItemFlavor_flavorId_createdAt_idx" ON "OrderItemFlavor"("flavorId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrderItemFlavor_orderItemId_scoopNumber_key" ON "OrderItemFlavor"("orderItemId", "scoopNumber");

-- CreateIndex
CREATE INDEX "OrderItemTopping_toppingId_createdAt_idx" ON "OrderItemTopping"("toppingId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "OrderItemTopping_orderItemId_toppingId_key" ON "OrderItemTopping"("orderItemId", "toppingId");

-- CreateIndex
CREATE UNIQUE INDEX "Payment_code_key" ON "Payment"("code");

-- CreateIndex
CREATE INDEX "Payment_orderId_paidAt_idx" ON "Payment"("orderId", "paidAt");

-- CreateIndex
CREATE INDEX "Payment_method_paidAt_idx" ON "Payment"("method", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX "Refund_code_key" ON "Refund"("code");

-- CreateIndex
CREATE INDEX "Refund_orderId_createdAt_idx" ON "Refund"("orderId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "WorkShift_code_key" ON "WorkShift"("code");

-- CreateIndex
CREATE INDEX "WorkShift_branchId_status_idx" ON "WorkShift"("branchId", "status");

-- CreateIndex
CREATE INDEX "WorkShift_userId_status_idx" ON "WorkShift"("userId", "status");

-- CreateIndex
CREATE INDEX "WorkShift_openedAt_idx" ON "WorkShift"("openedAt");

-- CreateIndex
CREATE INDEX "ShiftExpense_shiftId_createdAt_idx" ON "ShiftExpense"("shiftId", "createdAt");

-- CreateIndex
CREATE INDEX "OrderStatusHistory_orderId_createdAt_idx" ON "OrderStatusHistory"("orderId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_entityType_entityId_idx" ON "AuditLog"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "AuditLog_userId_createdAt_idx" ON "AuditLog"("userId", "createdAt");

-- CreateIndex
CREATE INDEX "AuditLog_action_createdAt_idx" ON "AuditLog"("action", "createdAt");
