-- AlterTable
ALTER TABLE "erp_suppliers" ADD COLUMN IF NOT EXISTS "trading_as" TEXT NOT NULL DEFAULT '';
