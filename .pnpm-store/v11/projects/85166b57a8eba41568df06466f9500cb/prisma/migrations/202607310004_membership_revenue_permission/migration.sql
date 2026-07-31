-- Add a dedicated permission for branch-scoped membership revenue reporting.
INSERT INTO `Permission` (`id`, `code`, `name`, `module`, `description`, `createdAt`, `updatedAt`)
SELECT
  'perm_membership_revenue_view',
  'memberships.revenue.view',
  'Xem doanh thu hội viên',
  'memberships',
  'Xem báo cáo doanh thu gói hội viên trong phạm vi chi nhánh được phân công',
  CURRENT_TIMESTAMP(3),
  CURRENT_TIMESTAMP(3)
WHERE NOT EXISTS (
  SELECT 1 FROM `Permission` WHERE `code` = 'memberships.revenue.view'
);

INSERT IGNORE INTO `RolePermission` (`roleId`, `permissionId`)
SELECT `Role`.`id`, `Permission`.`id`
FROM `Role`
JOIN `Permission` ON `Permission`.`code` = 'memberships.revenue.view'
WHERE `Role`.`code` IN ('MANAGER', 'CASHIER', 'WAREHOUSE', 'STAFF');
