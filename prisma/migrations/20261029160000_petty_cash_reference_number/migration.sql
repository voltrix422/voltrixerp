-- Petty cash allocation reference numbers (PC-00001)
ALTER TABLE "erp_petty_cash_allocations" ADD COLUMN IF NOT EXISTS "reference_number" TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS "erp_petty_cash_allocations_reference_number_idx"
  ON "erp_petty_cash_allocations"("reference_number");
