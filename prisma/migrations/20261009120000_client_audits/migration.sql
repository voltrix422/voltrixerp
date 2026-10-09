-- Client stock / sales / credit audits (periodic dealer reconciliation)
CREATE TABLE IF NOT EXISTS "erp_client_audits" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "client_name" TEXT NOT NULL DEFAULT '',
    "audit_date" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "notes" TEXT NOT NULL DEFAULT '',
    "signed_by_name" TEXT NOT NULL DEFAULT '',
    "signature_data_url" TEXT,
    "created_by" TEXT NOT NULL DEFAULT '',
    "created_by_user_id" TEXT,
    "lines" JSONB NOT NULL DEFAULT '[]',
    "order_ids" JSONB NOT NULL DEFAULT '[]',
    "stock_given_qty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stock_sold_qty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "stock_left_qty" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "sold_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "left_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "credit_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "previous_audit_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "erp_client_audits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "erp_client_audits_client_id_idx" ON "erp_client_audits"("client_id");
CREATE INDEX IF NOT EXISTS "erp_client_audits_audit_date_idx" ON "erp_client_audits"("audit_date");
CREATE INDEX IF NOT EXISTS "erp_client_audits_status_idx" ON "erp_client_audits"("status");
