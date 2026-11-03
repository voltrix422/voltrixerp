-- CreateTable
CREATE TABLE "erp_installer_cashback_requests" (
    "id" TEXT NOT NULL,
    "full_name" TEXT NOT NULL,
    "cnic" TEXT NOT NULL,
    "phone" TEXT NOT NULL,
    "install_place" TEXT NOT NULL,
    "product_id" TEXT NOT NULL DEFAULT '',
    "product_name" TEXT NOT NULL,
    "quantity" INTEGER NOT NULL DEFAULT 1,
    "image_urls" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT NOT NULL DEFAULT '',
    "cashback_amount" DOUBLE PRECISION,
    "status" TEXT NOT NULL DEFAULT 'new',
    "admin_notes" TEXT NOT NULL DEFAULT '',
    "reviewed_by" TEXT NOT NULL DEFAULT '',
    "reviewed_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erp_installer_cashback_requests_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "erp_installer_cashback_requests_status_created_at_idx" ON "erp_installer_cashback_requests"("status", "created_at");

-- CreateIndex
CREATE INDEX "erp_installer_cashback_requests_phone_idx" ON "erp_installer_cashback_requests"("phone");

-- CreateIndex
CREATE INDEX "erp_installer_cashback_requests_cnic_idx" ON "erp_installer_cashback_requests"("cnic");
