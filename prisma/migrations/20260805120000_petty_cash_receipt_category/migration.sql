-- AlterTable
ALTER TABLE "erp_petty_cash_receipts" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL DEFAULT 'Other';
CREATE INDEX IF NOT EXISTS "erp_petty_cash_receipts_category_idx" ON "erp_petty_cash_receipts"("category");
