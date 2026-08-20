-- Archive flag: hide from Finance money-out while keeping in Purchase → Archived
ALTER TABLE "erp_import_shipments" ADD COLUMN IF NOT EXISTS "archived" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "erp_import_shipments" ADD COLUMN IF NOT EXISTS "archive_remark" TEXT NOT NULL DEFAULT '';
ALTER TABLE "erp_import_shipments" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3);
ALTER TABLE "erp_import_shipments" ADD COLUMN IF NOT EXISTS "archived_by" TEXT NOT NULL DEFAULT '';

CREATE INDEX IF NOT EXISTS "erp_import_shipments_archived_idx" ON "erp_import_shipments"("archived");
