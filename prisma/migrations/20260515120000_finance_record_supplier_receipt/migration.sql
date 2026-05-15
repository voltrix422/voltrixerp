-- AlterTable
ALTER TABLE "erp_finance_records" ADD COLUMN IF NOT EXISTS "supplier_name" TEXT NOT NULL DEFAULT '';
ALTER TABLE "erp_finance_records" ADD COLUMN IF NOT EXISTS "receipt_person_name" TEXT NOT NULL DEFAULT '';
