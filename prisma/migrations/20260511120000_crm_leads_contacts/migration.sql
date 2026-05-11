-- CreateTable
CREATE TABLE "crm_leads" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "company" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "source" TEXT NOT NULL DEFAULT 'csv',
    "status" TEXT NOT NULL DEFAULT 'new',
    "imported_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "created_by_id" TEXT,

    CONSTRAINT "crm_leads_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "crm_lead_contacts" (
    "id" TEXT NOT NULL,
    "lead_id" TEXT NOT NULL,
    "contacted_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "contacted_by" TEXT NOT NULL,
    "contacted_by_id" TEXT,
    "screenshot_urls" JSONB NOT NULL DEFAULT '[]',
    "lead_response" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',

    CONSTRAINT "crm_lead_contacts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "crm_lead_contacts_lead_id_idx" ON "crm_lead_contacts"("lead_id");

-- CreateIndex
CREATE INDEX "crm_lead_contacts_contacted_at_idx" ON "crm_lead_contacts"("contacted_at");

-- CreateIndex
CREATE INDEX "crm_lead_contacts_contacted_by_contacted_at_idx" ON "crm_lead_contacts"("contacted_by", "contacted_at");

-- AddForeignKey
ALTER TABLE "crm_lead_contacts" ADD CONSTRAINT "crm_lead_contacts_lead_id_fkey" FOREIGN KEY ("lead_id") REFERENCES "crm_leads"("id") ON DELETE CASCADE ON UPDATE CASCADE;
