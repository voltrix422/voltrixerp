-- AlterTable
ALTER TABLE "erp_orders" ADD COLUMN IF NOT EXISTS "replacement_lines" JSONB NOT NULL DEFAULT '[]';
