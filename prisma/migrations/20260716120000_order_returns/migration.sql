-- Order returns: status metadata, refund payments JSON, inventory restore marker
ALTER TABLE "erp_orders" ADD COLUMN IF NOT EXISTS "returned_at" TEXT;
ALTER TABLE "erp_orders" ADD COLUMN IF NOT EXISTS "returned_by" TEXT;
ALTER TABLE "erp_orders" ADD COLUMN IF NOT EXISTS "return_reason" TEXT NOT NULL DEFAULT '';
ALTER TABLE "erp_orders" ADD COLUMN IF NOT EXISTS "inventory_returned_at" TEXT;
ALTER TABLE "erp_orders" ADD COLUMN IF NOT EXISTS "return_payments" JSONB NOT NULL DEFAULT '[]';

CREATE INDEX IF NOT EXISTS "erp_orders_status_idx" ON "erp_orders"("status");
