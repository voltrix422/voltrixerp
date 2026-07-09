CREATE TABLE "erp_advance_accounts" (
    "id" TEXT NOT NULL,
    "purchase_scope_id" TEXT NOT NULL DEFAULT 'P1',
    "person_name" TEXT NOT NULL,
    "purpose" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'open',
    "transactions" JSONB NOT NULL DEFAULT '[]',
    "total_deposited" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_spent" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "balance" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_by" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "erp_advance_accounts_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "erp_advance_accounts_purchase_scope_id_idx" ON "erp_advance_accounts"("purchase_scope_id");
CREATE INDEX "erp_advance_accounts_status_idx" ON "erp_advance_accounts"("status");
