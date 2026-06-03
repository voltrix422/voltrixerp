ALTER TABLE "erp_orders" ADD COLUMN IF NOT EXISTS "payment_terms" TEXT NOT NULL DEFAULT 'full';
ALTER TABLE "erp_orders" ADD COLUMN IF NOT EXISTS "credit_approved_at" TEXT;
ALTER TABLE "erp_orders" ADD COLUMN IF NOT EXISTS "credit_approved_by" TEXT;
ALTER TABLE "erp_orders" ADD COLUMN IF NOT EXISTS "credit_note" TEXT;
