-- AlterTable
ALTER TABLE "erp_orders" ADD COLUMN "branch_id" TEXT;
ALTER TABLE "erp_orders" ADD COLUMN "source" TEXT;

-- CreateIndex
CREATE INDEX "erp_orders_branch_id_idx" ON "erp_orders"("branch_id");
CREATE INDEX "erp_orders_source_idx" ON "erp_orders"("source");
