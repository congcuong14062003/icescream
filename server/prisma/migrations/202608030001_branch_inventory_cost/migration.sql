-- Store operational ingredient costs per branch instead of sharing one value
-- from Ingredient across all branches.
ALTER TABLE `Inventory`
  ADD COLUMN `lastCost` INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN `averageCost` INTEGER NOT NULL DEFAULT 0;

UPDATE `Inventory` i
INNER JOIN `Ingredient` ingredient ON ingredient.`id` = i.`ingredientId`
SET i.`lastCost` = ingredient.`lastCost`,
    i.`averageCost` = ingredient.`averageCost`;
