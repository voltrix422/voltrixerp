ALTER TABLE "erp_users"
ADD COLUMN "purchase_scopes" JSONB NOT NULL DEFAULT '[]';

ALTER TABLE "erp_suppliers"
ADD COLUMN "purchase_scope_id" TEXT NOT NULL DEFAULT 'P1';

ALTER TABLE "erp_purchase_ledger"
ADD COLUMN "purchase_scope_id" TEXT NOT NULL DEFAULT 'P1';

CREATE INDEX "erp_suppliers_purchase_scope_id_idx" ON "erp_suppliers"("purchase_scope_id");
CREATE INDEX "erp_purchase_ledger_purchase_scope_id_idx" ON "erp_purchase_ledger"("purchase_scope_id");
