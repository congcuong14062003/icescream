CREATE TABLE `Expense` (
  `id` VARCHAR(191) NOT NULL,
  `branchId` VARCHAR(191) NOT NULL,
  `createdById` VARCHAR(191) NOT NULL,
  `category` ENUM('COGS','PERSONNEL','RENT','UTILITIES','MARKETING','OPERATIONS','SHRINKAGE','MAINTENANCE','FINANCE','TAX','DEPRECIATION','OTHER') NOT NULL,
  `amount` INTEGER NOT NULL,
  `description` TEXT NOT NULL,
  `incurredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
  `updatedAt` DATETIME(3) NOT NULL,
  UNIQUE INDEX `Expense_id_key`(`id`),
  INDEX `Expense_branchId_incurredAt_idx`(`branchId`, `incurredAt`),
  INDEX `Expense_category_incurredAt_idx`(`category`, `incurredAt`),
  PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Expense` ADD CONSTRAINT `Expense_branchId_fkey`
  FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE `Expense` ADD CONSTRAINT `Expense_createdById_fkey`
  FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;
