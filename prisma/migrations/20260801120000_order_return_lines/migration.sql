-- Partial order returns: track which line items / quantities were returned
ALTER TABLE "erp_orders" ADD COLUMN IF NOT EXISTS "return_lines" JSONB NOT NULL DEFAULT '[]';
