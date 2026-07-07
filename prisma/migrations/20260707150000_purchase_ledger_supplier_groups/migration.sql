-- Add supplier_groups JSON for project-based multi-supplier purchases
ALTER TABLE "erp_purchase_ledger" ADD COLUMN IF NOT EXISTS "supplier_groups" JSONB NOT NULL DEFAULT '[]';
