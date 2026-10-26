-- Supplier discount reduces payable total; not treated as cash paid out.
ALTER TABLE "erp_purchase_ledger"
ADD COLUMN IF NOT EXISTS "supplier_discount" DOUBLE PRECISION NOT NULL DEFAULT 0;
