-- Investor portal only. Investment start date for ROI term display.
ALTER TABLE "erp_users" ADD COLUMN IF NOT EXISTS "investor_invested_at" TEXT NOT NULL DEFAULT '';
