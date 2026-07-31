CREATE TABLE `PaymentStatusHistory` (
    `id` VARCHAR(191) NOT NULL,
    `orderId` VARCHAR(191) NOT NULL,
    `fromStatus` ENUM('UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED', 'PARTIALLY_REFUNDED') NULL,
    `status` ENUM('UNPAID', 'PARTIALLY_PAID', 'PAID', 'REFUNDED', 'PARTIALLY_REFUNDED') NOT NULL,
    `changedById` VARCHAR(191) NOT NULL,
    `amount` INTEGER NULL,
    `method` ENUM('CASH', 'BANK_TRANSFER', 'CARD', 'EWALLET', 'MIXED') NULL,
    `note` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `PaymentStatusHistory_orderId_createdAt_idx`(`orderId`, `createdAt`),
    INDEX `PaymentStatusHistory_status_createdAt_idx`(`status`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

ALTER TABLE `PaymentStatusHistory`
    ADD CONSTRAINT `PaymentStatusHistory_orderId_fkey`
    FOREIGN KEY (`orderId`) REFERENCES `Order`(`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
    ADD CONSTRAINT `PaymentStatusHistory_changedById_fkey`
    FOREIGN KEY (`changedById`) REFERENCES `User`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO `PaymentStatusHistory` (
    `id`, `orderId`, `fromStatus`, `status`, `changedById`, `amount`, `method`, `note`, `createdAt`
)
SELECT
    UUID(),
    `id`,
    NULL,
    `paymentStatus`,
    `createdById`,
    CASE WHEN `customerPaid` > 0 THEN `customerPaid` ELSE NULL END,
    NULL,
    'Kh?i t?o l?ch s? t? tr?ng th?i thanh to?n hi?n t?i',
    `createdAt`
FROM `Order`;
