-- AlterTable
ALTER TABLE "crm_leads" ADD COLUMN "assigned_to_user_id" TEXT,
ADD COLUMN "assigned_to_name" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX "crm_leads_assigned_to_user_id_idx" ON "crm_leads"("assigned_to_user_id");
