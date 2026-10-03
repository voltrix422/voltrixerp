-- Investor portal only. Custom ROI end date for invest-from / invest-to range.
ALTER TABLE "erp_users" ADD COLUMN IF NOT EXISTS "investor_invested_until" TEXT NOT NULL DEFAULT '';
