-- Branch-scoped POS: link users, terminals, and sales to branches
ALTER TABLE `erp_users` ADD COLUMN `branch_id` VARCHAR(191) NULL;
CREATE INDEX `erp_users_branch_id_idx` ON `erp_users`(`branch_id`);

ALTER TABLE `erp_pos_terminals` ADD COLUMN `branch_id` VARCHAR(191) NULL;
CREATE INDEX `erp_pos_terminals_branch_id_idx` ON `erp_pos_terminals`(`branch_id`);

ALTER TABLE `erp_pos_sales` ADD COLUMN `branch_id` VARCHAR(191) NULL;
CREATE INDEX `erp_pos_sales_branch_id_idx` ON `erp_pos_sales`(`branch_id`);
