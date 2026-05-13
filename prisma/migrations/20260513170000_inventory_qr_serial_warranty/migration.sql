CREATE TABLE IF NOT EXISTS "erp_inventory_serial_units" (
  "id" TEXT NOT NULL,
  "serial_number" TEXT NOT NULL,
  "assigned_name" TEXT NOT NULL DEFAULT '',
  "product_name" TEXT NOT NULL DEFAULT '',
  "model" TEXT NOT NULL DEFAULT '',
  "specs" TEXT NOT NULL DEFAULT '',
  "raw_payload" TEXT NOT NULL DEFAULT '',
  "inventory_stock_id" TEXT,
  "warranty_id" TEXT,
  "warranty_start_date" TIMESTAMP(3),
  "warranty_end_date" TIMESTAMP(3),
  "status" TEXT NOT NULL DEFAULT 'in_stock',
  "notes" TEXT NOT NULL DEFAULT '',
  "scanned_by" TEXT NOT NULL DEFAULT 'system',
  "scanned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "erp_inventory_serial_units_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "erp_inventory_serial_units_serial_number_key"
  ON "erp_inventory_serial_units"("serial_number");

CREATE INDEX IF NOT EXISTS "erp_inventory_serial_units_inventory_stock_id_idx"
  ON "erp_inventory_serial_units"("inventory_stock_id");

CREATE TABLE IF NOT EXISTS "erp_warranty_claims" (
  "id" TEXT NOT NULL,
  "unit_id" TEXT NOT NULL,
  "serial_number" TEXT NOT NULL,
  "claim_reason" TEXT NOT NULL,
  "status" TEXT NOT NULL DEFAULT 'pending',
  "notes" TEXT NOT NULL DEFAULT '',
  "claimed_by" TEXT NOT NULL DEFAULT 'system',
  "reviewed_by" TEXT,
  "reviewed_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "erp_warranty_claims_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "erp_warranty_claims_unit_id_idx"
  ON "erp_warranty_claims"("unit_id");

CREATE INDEX IF NOT EXISTS "erp_warranty_claims_serial_number_idx"
  ON "erp_warranty_claims"("serial_number");

ALTER TABLE "erp_warranties"
ADD COLUMN IF NOT EXISTS "serial_number" TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS "erp_warranties_serial_number_key"
  ON "erp_warranties"("serial_number");
