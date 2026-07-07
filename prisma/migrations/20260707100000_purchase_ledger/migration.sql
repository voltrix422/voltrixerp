CREATE TABLE "erp_purchase_ledger" (
    "id" TEXT NOT NULL,
    "ledger_number" TEXT NOT NULL,
    "transaction_date" TEXT NOT NULL,
    "link_mode" TEXT NOT NULL DEFAULT 'general',
    "project_name" TEXT NOT NULL DEFAULT '',
    "order_id" TEXT,
    "order_number" TEXT NOT NULL DEFAULT '',
    "supplier_id" TEXT,
    "supplier_name" TEXT NOT NULL DEFAULT '',
    "product_name" TEXT NOT NULL DEFAULT '',
    "transaction_type" TEXT NOT NULL DEFAULT 'purchase',
    "category" TEXT NOT NULL DEFAULT 'expense',
    "quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "unit_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_amount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "due_date" TEXT NOT NULL DEFAULT '',
    "account_details" TEXT NOT NULL DEFAULT '',
    "payment_proof_url" TEXT NOT NULL DEFAULT '',
    "payment_proof_name" TEXT NOT NULL DEFAULT '',
    "created_by" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "erp_purchase_ledger_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "erp_purchase_ledger_ledger_number_key" ON "erp_purchase_ledger"("ledger_number");
CREATE INDEX "erp_purchase_ledger_transaction_date_idx" ON "erp_purchase_ledger"("transaction_date");
CREATE INDEX "erp_purchase_ledger_supplier_id_idx" ON "erp_purchase_ledger"("supplier_id");
CREATE INDEX "erp_purchase_ledger_order_id_idx" ON "erp_purchase_ledger"("order_id");
CREATE INDEX "erp_purchase_ledger_category_idx" ON "erp_purchase_ledger"("category");
