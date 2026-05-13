ALTER TABLE "erp_petty_cash_allocations"
ADD COLUMN IF NOT EXISTS "reviewed_by" TEXT,
ADD COLUMN IF NOT EXISTS "reviewed_at" TIMESTAMP(3),
ADD COLUMN IF NOT EXISTS "review_notes" TEXT;
