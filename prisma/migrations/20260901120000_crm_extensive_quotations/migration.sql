-- Supplier rate book for extensive (Q2) quotations
CREATE TABLE "crm_quote_rates" (
    "id" TEXT NOT NULL,
    "item_name" TEXT NOT NULL,
    "supplier" TEXT NOT NULL,
    "rate" DOUBLE PRECISION NOT NULL,
    "rate_date" TEXT NOT NULL,
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,

    CONSTRAINT "crm_quote_rates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "crm_quote_rates_item_name_idx" ON "crm_quote_rates"("item_name");
CREATE INDEX "crm_quote_rates_supplier_idx" ON "crm_quote_rates"("supplier");

-- Extensive CRM quotations (Q2)
CREATE TABLE "crm_extensive_quotations" (
    "id" TEXT NOT NULL,
    "quotation_number" TEXT NOT NULL,
    "recipient_name" TEXT NOT NULL,
    "recipient_company" TEXT NOT NULL DEFAULT '',
    "recipient_address" TEXT NOT NULL DEFAULT '',
    "quote_date" TEXT NOT NULL,
    "valid_until" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "show_branding" BOOLEAN NOT NULL DEFAULT true,
    "items" JSONB NOT NULL DEFAULT '[]',
    "terms" JSONB NOT NULL DEFAULT '[]',
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" TEXT NOT NULL,
    "owner_user_id" TEXT,

    CONSTRAINT "crm_extensive_quotations_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "crm_extensive_quotations_owner_user_id_idx" ON "crm_extensive_quotations"("owner_user_id");
