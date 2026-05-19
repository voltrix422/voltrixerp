ALTER TABLE "erp_branch_inventory_transfers" ADD COLUMN IF NOT EXISTS "transfer_batch_id" TEXT;

CREATE INDEX IF NOT EXISTS "erp_branch_inventory_transfers_transfer_batch_id_idx"
  ON "erp_branch_inventory_transfers"("transfer_batch_id");
