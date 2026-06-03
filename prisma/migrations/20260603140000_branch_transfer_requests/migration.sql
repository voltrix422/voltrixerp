-- CreateTable
CREATE TABLE "erp_branch_transfer_requests" (
    "id" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'pending',
    "mode" TEXT NOT NULL,
    "from_branch_id" TEXT,
    "from_branch_name" TEXT NOT NULL,
    "from_branch_code" TEXT NOT NULL DEFAULT '',
    "to_branch_id" TEXT NOT NULL,
    "to_branch_name" TEXT NOT NULL,
    "to_branch_code" TEXT NOT NULL DEFAULT '',
    "payload_json" TEXT NOT NULL,
    "line_count" INTEGER NOT NULL DEFAULT 0,
    "total_quantity" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "summary" TEXT NOT NULL DEFAULT '',
    "requested_by" TEXT NOT NULL,
    "requested_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewed_by" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "review_note" TEXT NOT NULL DEFAULT '',
    "transfer_batch_id" TEXT,

    CONSTRAINT "erp_branch_transfer_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "erp_branch_transfer_requests_status_idx" ON "erp_branch_transfer_requests"("status");
CREATE INDEX "erp_branch_transfer_requests_from_branch_id_idx" ON "erp_branch_transfer_requests"("from_branch_id");
CREATE INDEX "erp_branch_transfer_requests_to_branch_id_idx" ON "erp_branch_transfer_requests"("to_branch_id");
