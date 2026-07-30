-- Each paid membership plan grants one specifically configured variant.
ALTER TABLE `MembershipPlan`
    ADD COLUMN `benefitVariantId` VARCHAR(191) NULL;

UPDATE `MembershipPlan` AS plan
SET plan.`benefitVariantId` = (
    SELECT variant.`id`
    FROM `MembershipPlanProduct` AS planProduct
    INNER JOIN `ProductVariant` AS variant
        ON variant.`productId` = planProduct.`productId`
    WHERE planProduct.`membershipPlanId` = plan.`id`
      AND variant.`isActive` = true
    ORDER BY variant.`price` ASC, variant.`createdAt` ASC
    LIMIT 1
)
WHERE plan.`benefitVariantId` IS NULL;

CREATE INDEX `MembershipPlan_benefitVariantId_idx`
    ON `MembershipPlan`(`benefitVariantId`);

ALTER TABLE `MembershipPlan`
    ADD CONSTRAINT `MembershipPlan_benefitVariantId_fkey`
    FOREIGN KEY (`benefitVariantId`) REFERENCES `ProductVariant`(`id`)
    ON DELETE RESTRICT ON UPDATE CASCADE;
