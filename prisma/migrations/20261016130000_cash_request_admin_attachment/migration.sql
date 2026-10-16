ALTER TABLE "erp_cash_requests"
  ADD COLUMN IF NOT EXISTS "admin_attachment_url" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "admin_attachment_name" TEXT NOT NULL DEFAULT '';
