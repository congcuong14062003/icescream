-- Every voucher belongs to one issuing branch and can only be redeemed there.
ALTER TABLE `CustomerVoucher`
    ADD COLUMN `branchId` VARCHAR(191) NULL,
    ADD COLUMN `createdById` VARCHAR(191) NULL,
    MODIFY COLUMN `issueReason` ENUM('TIER_UPGRADE', 'QUALIFYING_ORDER', 'MANUAL') NOT NULL;

UPDATE `CustomerVoucher` AS voucher
INNER JOIN `Order` AS issuedOrder
    ON issuedOrder.`id` = voucher.`issuedFromOrderId`
SET
    voucher.`branchId` = issuedOrder.`branchId`,
    voucher.`createdById` = issuedOrder.`createdById`
WHERE voucher.`branchId` IS NULL;

UPDATE `CustomerVoucher` AS voucher
INNER JOIN `Order` AS usedOrder
    ON usedOrder.`id` = voucher.`usedOrderId`
SET
    voucher.`branchId` = usedOrder.`branchId`,
    voucher.`createdById` = COALESCE(voucher.`createdById`, usedOrder.`createdById`)
WHERE voucher.`branchId` IS NULL;

UPDATE `CustomerVoucher`
SET `branchId` = (
    SELECT `id`
    FROM `Branch`
    WHERE `deletedAt` IS NULL
    ORDER BY `createdAt` ASC
    LIMIT 1
)
WHERE `branchId` IS NULL;

ALTER TABLE `CustomerVoucher`
    MODIFY COLUMN `branchId` VARCHAR(191) NOT NULL;

CREATE INDEX `CustomerVoucher_branchId_status_expiresAt_idx`
    ON `CustomerVoucher`(`branchId`, `status`, `expiresAt`);
CREATE INDEX `CustomerVoucher_createdById_createdAt_idx`
    ON `CustomerVoucher`(`createdById`, `createdAt`);

ALTER TABLE `CustomerVoucher`
    ADD CONSTRAINT `CustomerVoucher_branchId_fkey`
    FOREIGN KEY (`branchId`) REFERENCES `Branch`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE,
    ADD CONSTRAINT `CustomerVoucher_createdById_fkey`
    FOREIGN KEY (`createdById`) REFERENCES `User`(`id`)
    ON DELETE SET NULL ON UPDATE CASCADE;
