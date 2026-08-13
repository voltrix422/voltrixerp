ALTER TABLE "erp_orders" ADD COLUMN IF NOT EXISTS "cashback_payments" JSONB NOT NULL DEFAULT '[]';
