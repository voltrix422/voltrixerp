-- AlterTable
ALTER TABLE "erp_inventory_stock" ADD COLUMN IF NOT EXISTS "faulty_qty" DOUBLE PRECISION NOT NULL DEFAULT 0;

-- AlterTable
ALTER TABLE "erp_manual_inventory_item" ADD COLUMN IF NOT EXISTS "faulty_qty" DOUBLE PRECISION NOT NULL DEFAULT 0;
