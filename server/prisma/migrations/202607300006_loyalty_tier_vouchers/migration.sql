-- Loyalty points are used only to determine tiers. Each tier can issue customer vouchers.
ALTER TABLE `MembershipLevel`
    ADD COLUMN `minPoints` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `voucherEnabled` BOOLEAN NOT NULL DEFAULT false,
    ADD COLUMN `voucherType` ENUM('PERCENT', 'FIXED_AMOUNT') NOT NULL DEFAULT 'FIXED_AMOUNT',
    ADD COLUMN `voucherValue` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `voucherMaxDiscount` INTEGER NULL,
    ADD COLUMN `voucherMinOrderValue` INTEGER NOT NULL DEFAULT 0,
    ADD COLUMN `voucherValidityDays` INTEGER NOT NULL DEFAULT 15,
    ADD COLUMN `voucherCooldownDays` INTEGER NOT NULL DEFAULT 15,
    ADD COLUMN `voucherRenewalOrderMinAmount` INTEGER NOT NULL DEFAULT 200000;

UPDATE `MembershipLevel`
SET
    `pointRate` = `pointRate` * 100,
    `minPoints` = CASE `code`
        WHEN 'NEW' THEN 0
        WHEN 'SILVER' THEN 100
        WHEN 'GOLD' THEN 700
        WHEN 'DIAMOND' THEN 2700
        ELSE `displayOrder` * 100
    END,
    `voucherEnabled` = CASE WHEN `code` = 'NEW' THEN false ELSE true END,
    `voucherValue` = CASE `code`
        WHEN 'SILVER' THEN 30000
        WHEN 'GOLD' THEN 50000
        WHEN 'DIAMOND' THEN 100000
        ELSE 0
    END;

UPDATE `Customer` AS customer
INNER JOIN `MembershipLevel` AS level ON level.`id` = customer.`membershipLevelId`
SET customer.`points` = GREATEST(customer.`points`, level.`minPoints`);

CREATE INDEX `MembershipLevel_minPoints_idx` ON `MembershipLevel`(`minPoints`);

ALTER TABLE `Order`
    ADD COLUMN `voucherDiscount` INTEGER NOT NULL DEFAULT 0;

CREATE TABLE `CustomerVoucher` (
    `id` VARCHAR(191) NOT NULL,
    `code` VARCHAR(191) NOT NULL,
    `customerId` VARCHAR(191) NOT NULL,
    `membershipLevelId` VARCHAR(191) NOT NULL,
    `issuedFromOrderId` VARCHAR(191) NULL,
    `usedOrderId` VARCHAR(191) NULL,
    `type` ENUM('PERCENT', 'FIXED_AMOUNT') NOT NULL,
    `value` INTEGER NOT NULL,
    `maxDiscount` INTEGER NULL,
    `minOrderValue` INTEGER NOT NULL DEFAULT 0,
    `issueReason` ENUM('TIER_UPGRADE', 'QUALIFYING_ORDER') NOT NULL,
    `status` ENUM('ACTIVE', 'USED', 'EXPIRED', 'CANCELLED') NOT NULL DEFAULT 'ACTIVE',
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `CustomerVoucher_code_key`(`code`),
    UNIQUE INDEX `CustomerVoucher_usedOrderId_key`(`usedOrderId`),
    INDEX `CustomerVoucher_customerId_status_expiresAt_idx`(`customerId`, `status`, `expiresAt`),
    INDEX `CustomerVoucher_membershipLevelId_createdAt_idx`(`membershipLevelId`, `createdAt`),
    INDEX `CustomerVoucher_issuedFromOrderId_idx`(`issuedFromOrderId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `CustomerVoucher`
    ADD CONSTRAINT `CustomerVoucher_customerId_fkey`
    FOREIGN KEY (`customerId`) REFERENCES `Customer`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `CustomerVoucher_membershipLevelId_fkey`
    FOREIGN KEY (`membershipLevelId`) REFERENCES `MembershipLevel`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `CustomerVoucher_issuedFromOrderId_fkey`
    FOREIGN KEY (`issuedFromOrderId`) REFERENCES `Order`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE,
    ADD CONSTRAINT `CustomerVoucher_usedOrderId_fkey`
    FOREIGN KEY (`usedOrderId`) REFERENCES `Order`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
