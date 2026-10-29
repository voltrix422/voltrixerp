-- Extend Q2 extensive quotations with full proposal content blocks
ALTER TABLE "crm_extensive_quotations" ADD COLUMN IF NOT EXISTS "intro_text" TEXT NOT NULL DEFAULT '';
ALTER TABLE "crm_extensive_quotations" ADD COLUMN IF NOT EXISTS "footer_text" TEXT NOT NULL DEFAULT '';
ALTER TABLE "crm_extensive_quotations" ADD COLUMN IF NOT EXISTS "projects" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "crm_extensive_quotations" ADD COLUMN IF NOT EXISTS "warranties" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "crm_extensive_quotations" ADD COLUMN IF NOT EXISTS "testimonials" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "crm_extensive_quotations" ADD COLUMN IF NOT EXISTS "custom_sections" JSONB NOT NULL DEFAULT '[]';
