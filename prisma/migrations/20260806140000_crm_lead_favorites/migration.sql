-- AlterTable
ALTER TABLE "crm_leads" ADD COLUMN "is_favorite" BOOLEAN NOT NULL DEFAULT false;

-- CreateIndex
CREATE INDEX "crm_leads_is_favorite_idx" ON "crm_leads"("is_favorite");
