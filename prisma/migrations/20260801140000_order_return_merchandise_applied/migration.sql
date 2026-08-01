-- Track whether returned qty was subtracted from order items / totals
ALTER TABLE "erp_orders" ADD COLUMN IF NOT EXISTS "return_merchandise_applied" BOOLEAN NOT NULL DEFAULT false;
