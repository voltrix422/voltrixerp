-- CreateTable
CREATE TABLE "erp_installment_estimates" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "client_name" TEXT NOT NULL DEFAULT '',
    "system_kw" DOUBLE PRECISION NOT NULL,
    "factor" DOUBLE PRECISION NOT NULL DEFAULT 1.5,
    "lines" JSONB NOT NULL DEFAULT '[]',
    "total_amount" DOUBLE PRECISION NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "created_by" TEXT NOT NULL DEFAULT '',
    "created_by_id" TEXT NOT NULL DEFAULT '',
    "updated_by" TEXT NOT NULL DEFAULT '',
    "updated_by_id" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erp_installment_estimates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "erp_installment_estimates_system_kw_idx" ON "erp_installment_estimates"("system_kw");

-- CreateIndex
CREATE INDEX "erp_installment_estimates_created_at_idx" ON "erp_installment_estimates"("created_at");
