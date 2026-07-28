-- AlterTable
ALTER TABLE "erp_website_pageviews" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL DEFAULT '';
ALTER TABLE "erp_website_pageviews" ADD COLUMN IF NOT EXISTS "utm_source" TEXT NOT NULL DEFAULT '';
ALTER TABLE "erp_website_pageviews" ADD COLUMN IF NOT EXISTS "utm_medium" TEXT NOT NULL DEFAULT '';
ALTER TABLE "erp_website_pageviews" ADD COLUMN IF NOT EXISTS "utm_campaign" TEXT NOT NULL DEFAULT '';

-- CreateIndex
CREATE INDEX IF NOT EXISTS "erp_website_pageviews_source_created_at_idx" ON "erp_website_pageviews"("source", "created_at");
