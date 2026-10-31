-- AlterTable
ALTER TABLE "crm_extensive_quotations" ADD COLUMN IF NOT EXISTS "prepared_by" TEXT NOT NULL DEFAULT '';
