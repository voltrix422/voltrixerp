-- AlterTable
ALTER TABLE "crm_leads" ADD COLUMN "follow_up_at" TIMESTAMP(3);
ALTER TABLE "crm_leads" ADD COLUMN "follow_up_notes" TEXT NOT NULL DEFAULT '';
