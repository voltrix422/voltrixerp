-- Link dispatched serial numbers to orders for warranty / claims lookup
ALTER TABLE `erp_orders` ADD COLUMN `fulfillment_serial_allocations` JSON NOT NULL DEFAULT ('[]');
