-- AlterTable
ALTER TABLE "crm_leads" ADD COLUMN "import_batch_id" TEXT;
ALTER TABLE "crm_leads" ADD COLUMN "import_uploader_name" TEXT;

-- CreateIndex
CREATE INDEX "crm_leads_import_batch_id_idx" ON "crm_leads"("import_batch_id");
