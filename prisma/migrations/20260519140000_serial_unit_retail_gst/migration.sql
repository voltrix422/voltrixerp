-- AlterTable
ALTER TABLE "erp_inventory_serial_units" ADD COLUMN IF NOT EXISTS "retail_price" DECIMAL(12,2);
ALTER TABLE "erp_inventory_serial_units" ADD COLUMN IF NOT EXISTS "gst_percent" DECIMAL(5,2);
