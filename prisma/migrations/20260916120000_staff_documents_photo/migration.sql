-- Persist HRM staff documents and photo on the server (not only the browser)
ALTER TABLE "erp_staff" ADD COLUMN IF NOT EXISTS "photo_url" TEXT NOT NULL DEFAULT '';
ALTER TABLE "erp_staff" ADD COLUMN IF NOT EXISTS "documents" JSONB NOT NULL DEFAULT '[]';
