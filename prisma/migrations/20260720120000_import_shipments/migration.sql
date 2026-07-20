-- CreateTable
CREATE TABLE IF NOT EXISTS "erp_import_shipments" (
    "id" TEXT NOT NULL,
    "purchase_scope_id" TEXT NOT NULL DEFAULT 'P1',
    "shipment_number" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "current_step" INTEGER NOT NULL DEFAULT 1,
    "supplier_id" TEXT,
    "supplier_name" TEXT NOT NULL DEFAULT '',
    "contract_ref" TEXT NOT NULL DEFAULT '',
    "contract_date" TEXT NOT NULL DEFAULT '',
    "incoterms" TEXT NOT NULL DEFAULT 'FOB',
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "fx_rate" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "origin_country" TEXT NOT NULL DEFAULT '',
    "origin_port" TEXT NOT NULL DEFAULT '',
    "destination_port" TEXT NOT NULL DEFAULT 'Karachi',
    "clearing_agent" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "bl_number" TEXT NOT NULL DEFAULT '',
    "vessel_name" TEXT NOT NULL DEFAULT '',
    "voyage_no" TEXT NOT NULL DEFAULT '',
    "etd" TEXT NOT NULL DEFAULT '',
    "eta" TEXT NOT NULL DEFAULT '',
    "ata" TEXT NOT NULL DEFAULT '',
    "igm_number" TEXT NOT NULL DEFAULT '',
    "igm_date" TEXT NOT NULL DEFAULT '',
    "gd_number" TEXT NOT NULL DEFAULT '',
    "gd_date" TEXT NOT NULL DEFAULT '',
    "psid" TEXT NOT NULL DEFAULT '',
    "pssid" TEXT NOT NULL DEFAULT '',
    "collectorate" TEXT NOT NULL DEFAULT '',
    "assessment_channel" TEXT NOT NULL DEFAULT '',
    "allocation_method" TEXT NOT NULL DEFAULT 'by_value',
    "landed_cost_locked" BOOLEAN NOT NULL DEFAULT false,
    "received_at_warehouse" BOOLEAN NOT NULL DEFAULT false,
    "warehouse_location" TEXT NOT NULL DEFAULT '',
    "received_date" TEXT NOT NULL DEFAULT '',
    "containers" JSONB NOT NULL DEFAULT '[]',
    "items" JSONB NOT NULL DEFAULT '[]',
    "charges" JSONB NOT NULL DEFAULT '[]',
    "attachments" JSONB NOT NULL DEFAULT '[]',
    "payments" JSONB NOT NULL DEFAULT '[]',
    "landed_cost_summary" JSONB NOT NULL DEFAULT '{}',
    "flow_history" JSONB NOT NULL DEFAULT '[]',
    "created_by" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erp_import_shipments_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "erp_import_shipments_purchase_scope_id_shipment_number_key"
  ON "erp_import_shipments"("purchase_scope_id", "shipment_number");

CREATE INDEX IF NOT EXISTS "erp_import_shipments_purchase_scope_id_idx"
  ON "erp_import_shipments"("purchase_scope_id");

CREATE INDEX IF NOT EXISTS "erp_import_shipments_status_idx"
  ON "erp_import_shipments"("status");

CREATE INDEX IF NOT EXISTS "erp_import_shipments_supplier_id_idx"
  ON "erp_import_shipments"("supplier_id");
