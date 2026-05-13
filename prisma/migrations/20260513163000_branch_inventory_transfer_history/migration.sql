CREATE TABLE IF NOT EXISTS "erp_branch_inventory_transfers" (
  "id" TEXT NOT NULL,
  "from_branch_id" TEXT,
  "from_branch_name" TEXT NOT NULL,
  "from_branch_code" TEXT NOT NULL DEFAULT '',
  "to_branch_id" TEXT NOT NULL,
  "to_branch_name" TEXT NOT NULL,
  "to_branch_code" TEXT NOT NULL DEFAULT '',
  "inventory_id" TEXT NOT NULL,
  "product_description" TEXT NOT NULL,
  "quantity" DOUBLE PRECISION NOT NULL,
  "unit" TEXT NOT NULL,
  "note" TEXT NOT NULL DEFAULT '',
  "transferred_by" TEXT NOT NULL,
  "transferred_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "erp_branch_inventory_transfers_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "erp_branch_inventory_transfers_from_branch_id_idx"
  ON "erp_branch_inventory_transfers"("from_branch_id");

CREATE INDEX IF NOT EXISTS "erp_branch_inventory_transfers_to_branch_id_idx"
  ON "erp_branch_inventory_transfers"("to_branch_id");
