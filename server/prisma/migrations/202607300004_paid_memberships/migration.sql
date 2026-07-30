-- Paid membership plans, subscriptions and daily benefit redemptions.
CREATE TABLE `MembershipPlan` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NOT NULL,
    `description` TEXT NULL,
    `price` INTEGER NOT NULL,
    `durationDays` INTEGER NOT NULL,
    `dailyFreeQuantity` INTEGER NOT NULL DEFAULT 1,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MembershipPlan_code_key`(`code`),
    INDEX `MembershipPlan_name_idx`(`name`),
    INDEX `MembershipPlan_isActive_createdAt_idx`(`isActive`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `MembershipPlanProduct` (
    `membershipPlanId` VARCHAR(191) NOT NULL,
    `productId` VARCHAR(191) NOT NULL,

    INDEX `MembershipPlanProduct_productId_idx`(`productId`),
    PRIMARY KEY (`membershipPlanId`, `productId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `MembershipSubscription` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `membershipPlanId` VARCHAR(191) NOT NULL,
    `branchId` VARCHAR(191) NOT NULL,
    `createdById` VARCHAR(191) NOT NULL,
    `startsAt` DATETIME(3) NOT NULL,
    `endsAt` DATETIME(3) NOT NULL,
    `amountPaid` INTEGER NOT NULL,
    `paymentMethod` ENUM('CASH', 'BANK_TRANSFER', 'CARD', 'EWALLET', 'MIXED') NOT NULL,
    `referenceCode` VARCHAR(191) NULL,
    `status` ENUM('ACTIVE', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `MembershipSubscription_code_key`(`code`),
    INDEX `MembershipSubscription_customerId_status_startsAt_endsAt_idx`(`customerId`, `status`, `startsAt`, `endsAt`),
    INDEX `MembershipSubscription_membershipPlanId_createdAt_idx`(`membershipPlanId`, `createdAt`),
    INDEX `MembershipSubscription_branchId_createdAt_idx`(`branchId`, `createdAt`),
    INDEX `MembershipSubscription_createdById_createdAt_idx`(`createdById`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

CREATE TABLE `MembershipBenefitUsage` (
    `id` VARCHAR(191) NOT NULL,
    `subscriptionId` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `benefitDate` DATE NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 1,
    `discountAmount` INTEGER NOT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `MembershipBenefitUsage_orderId_key`(`orderId`),
    UNIQUE INDEX `MembershipBenefitUsage_subscriptionId_benefitDate_key`(`subscriptionId`, `benefitDate`),
    INDEX `MembershipBenefitUsage_benefitDate_createdAt_idx`(`benefitDate`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `Order` ADD COLUMN `membershipDiscount` INTEGER NOT NULL DEFAULT 0;

ALTER TABLE `MembershipPlanProduct`
    ADD CONSTRAINT `MembershipPlanProduct_membershipPlanId_fkey`
    FOREIGN KEY (`membershipPlanId`) REFERENCES `MembershipPlan`(`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `MembershipPlanProduct_productId_fkey`
    FOREIGN KEY (`productId`) REFERENCES `Product`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `MembershipSubscription`
    ADD CONSTRAINT `MembershipSubscription_customerId_fkey`
    FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `MembershipSubscription_membershipPlanId_fkey`
    FOREIGN KEY (`membershipPlanId`) REFERENCES `MembershipPlan`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `MembershipSubscription_branchId_fkey`
    FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `MembershipSubscription_createdById_fkey`
    FOREIGN KEY (`createdById`) REFERENCES `User`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE `MembershipBenefitUsage`
    ADD CONSTRAINT `MembershipBenefitUsage_subscriptionId_fkey`
    FOREIGN KEY (`subscriptionId`) REFERENCES `MembershipSubscription`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `MembershipBenefitUsage_orderId_fkey`
    FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`) ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO `MembershipPlan` (
    `id`, `code`, `name`, `description`, `price`, `durationDays`,
    `dailyFreeQuantity`, `isActive`, `createdAt`, `updatedAt`
) VALUES (
    'membership-plan-monthly',
    'HOIVIEN30',
    'Hội viên Kem Mỗi Ngày',
    'Hiệu lực 30 ngày, mỗi ngày được miễn phí 1 sản phẩm kem đủ điều kiện.',
    399000,
    30,
    1,
    true,
    CURRENT_TIMESTAMP(3),
    CURRENT_TIMESTAMP(3)
) ON DUPLICATE KEY UPDATE
    `name` = VALUES(`name`),
    `description` = VALUES(`description`),
    `updatedAt` = CURRENT_TIMESTAMP(3);

INSERT IGNORE INTO `MembershipPlanProduct` (`membershipPlanId`, `productId`)
SELECT 'membership-plan-monthly', `id`
FROM `Product`
WHERE `deletedAt` IS NULL
  AND `status` = 'ACTIVE'
  AND `categoryId` IN (
      SELECT `id` FROM `Category`
      WHERE `name` IN ('Kem ốc quế', 'Kem ly', 'Kem que')
  );
