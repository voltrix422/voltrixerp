-- Add tax fields to normal purchase ledger entries
ALTER TABLE "erp_purchase_ledger"
  ADD COLUMN IF NOT EXISTS "tax_percent" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS "tax_amount" DOUBLE PRECISION NOT NULL DEFAULT 0;
