-- Investor portal only. Does not touch CRM orders, clients, or other ERP tables.
ALTER TABLE "erp_users" ADD COLUMN IF NOT EXISTS "investor_investment" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "erp_users" ADD COLUMN IF NOT EXISTS "investor_roi_percent" DOUBLE PRECISION NOT NULL DEFAULT 0;
ALTER TABLE "erp_users" ADD COLUMN IF NOT EXISTS "investor_roi_period" TEXT NOT NULL DEFAULT 'annual';
