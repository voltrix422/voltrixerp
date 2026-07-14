CREATE TABLE "erp_client_projects" (
    "id" TEXT NOT NULL,
    "purchase_scope_id" TEXT NOT NULL DEFAULT 'P1',
    "project_name" TEXT NOT NULL,
    "client_name" TEXT NOT NULL DEFAULT '',
    "client_phone" TEXT NOT NULL DEFAULT '',
    "budget" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "notes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'open',
    "transactions" JSONB NOT NULL DEFAULT '[]',
    "total_received" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total_expenses" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "profit" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "created_by" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "erp_client_projects_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "erp_client_projects_purchase_scope_id_idx" ON "erp_client_projects"("purchase_scope_id");
CREATE INDEX "erp_client_projects_status_idx" ON "erp_client_projects"("status");
