-- CreateTable
CREATE TABLE `StockIssue` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `reason` ENUM('INTERNAL_USE', 'DAMAGED', 'EXPIRED', 'SAMPLE', 'OTHER') NOT NULL,
    `note` TEXT NULL,
    `totalCost` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `StockIssue_code_key`(`code`),
    INDEX `StockIssue_branchId_createdAt_idx`(`branchId`, `createdAt`),
    INDEX `StockIssue_reason_createdAt_idx`(`reason`, `createdAt`),
    INDEX `StockIssue_createdById_createdAt_idx`(`createdById`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StockIssueItem` (
    `id` VARCHAR(191) NOT NULL,
    `stockIssueId` VARCHAR(191) NOT NULL,
    `ingredientId` VARCHAR(191) NOT NULL,
    `quantity` DOUBLE NOT NULL,
    `unitCost` INTEGER NOT NULL,
    `lineCost` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `StockIssueItem_ingredientId_createdAt_idx`(`ingredientId`, `createdAt`),
    UNIQUE INDEX `StockIssueItem_stockIssueId_ingredientId_key`(`stockIssueId`, `ingredientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `Stocktake` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `note` TEXT NULL,
    `totalVarianceCost` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `Stocktake_code_key`(`code`),
    INDEX `Stocktake_branchId_createdAt_idx`(`branchId`, `createdAt`),
    INDEX `Stocktake_createdById_createdAt_idx`(`createdById`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `StocktakeItem` (
    `id` VARCHAR(191) NOT NULL,
    `stocktakeId` VARCHAR(191) NOT NULL,
    `ingredientId` VARCHAR(191) NOT NULL,
    `systemQuantity` DOUBLE NOT NULL,
    `actualQuantity` DOUBLE NOT NULL,
    `difference` DOUBLE NOT NULL,
    `unitCost` INTEGER NOT NULL,
    `varianceCost` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `StocktakeItem_ingredientId_createdAt_idx`(`ingredientId`, `createdAt`),
    UNIQUE INDEX `StocktakeItem_stocktakeId_ingredientId_key`(`stocktakeId`, `ingredientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `StockIssue` ADD CONSTRAINT `StockIssue_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockIssue` ADD CONSTRAINT `StockIssue_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockIssueItem` ADD CONSTRAINT `StockIssueItem_stockIssueId_fkey` FOREIGN KEY (`stockIssueId`) REFERENCES `StockIssue`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StockIssueItem` ADD CONSTRAINT `StockIssueItem_ingredientId_fkey` FOREIGN KEY (`ingredientId`) REFERENCES `Ingredient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Stocktake` ADD CONSTRAINT `Stocktake_branchId_fkey` FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `Stocktake` ADD CONSTRAINT `Stocktake_createdById_fkey` FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StocktakeItem` ADD CONSTRAINT `StocktakeItem_stocktakeId_fkey` FOREIGN KEY (`stocktakeId`) REFERENCES `Stocktake`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `StocktakeItem` ADD CONSTRAINT `StocktakeItem_ingredientId_fkey` FOREIGN KEY (`ingredientId`) REFERENCES `Ingredient`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
