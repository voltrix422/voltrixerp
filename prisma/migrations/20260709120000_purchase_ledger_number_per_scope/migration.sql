-- Ledger numbers are generated per purchase scope (P1, P2, ...), so the
-- uniqueness constraint must be scoped too. The old global unique index made
-- creating e.g. PL-0008 in scope P2 fail when P1 already had PL-0008.
DROP INDEX IF EXISTS "erp_purchase_ledger_ledger_number_key";

CREATE UNIQUE INDEX "erp_purchase_ledger_purchase_scope_id_ledger_number_key"
ON "erp_purchase_ledger"("purchase_scope_id", "ledger_number");
