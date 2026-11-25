-- CreateTable
CREATE TABLE "erp_installment_clients" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "cnic" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "product" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "created_by" TEXT NOT NULL DEFAULT '',
    "created_by_id" TEXT NOT NULL DEFAULT '',
    "updated_by" TEXT NOT NULL DEFAULT '',
    "updated_by_id" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erp_installment_clients_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erp_installment_documents" (
    "id" TEXT NOT NULL,
    "client_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "custom_label" TEXT NOT NULL DEFAULT '',
    "file_name" TEXT NOT NULL DEFAULT '',
    "file_url" TEXT NOT NULL,
    "uploaded_by" TEXT NOT NULL DEFAULT '',
    "uploaded_by_id" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "erp_installment_documents_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "erp_installment_clients_name_idx" ON "erp_installment_clients"("name");

-- CreateIndex
CREATE INDEX "erp_installment_clients_phone_idx" ON "erp_installment_clients"("phone");

-- CreateIndex
CREATE INDEX "erp_installment_clients_created_at_idx" ON "erp_installment_clients"("created_at");

-- CreateIndex
CREATE INDEX "erp_installment_documents_client_id_created_at_idx" ON "erp_installment_documents"("client_id", "created_at");

-- CreateIndex
CREATE INDEX "erp_installment_documents_label_idx" ON "erp_installment_documents"("label");

-- AddForeignKey
ALTER TABLE "erp_installment_documents" ADD CONSTRAINT "erp_installment_documents_client_id_fkey" FOREIGN KEY ("client_id") REFERENCES "erp_installment_clients"("id") ON DELETE CASCADE ON UPDATE CASCADE;
