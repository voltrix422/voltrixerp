-- AlterTable
ALTER TABLE "erp_finance_records" ADD COLUMN IF NOT EXISTS "petty_cash_allocation_id" TEXT NOT NULL DEFAULT '';
ALTER TABLE "erp_finance_records" ADD COLUMN IF NOT EXISTS "petty_cash_receipt_id" TEXT NOT NULL DEFAULT '';
ALTER TABLE "erp_finance_records" ADD COLUMN IF NOT EXISTS "petty_cash_label" TEXT NOT NULL DEFAULT '';
