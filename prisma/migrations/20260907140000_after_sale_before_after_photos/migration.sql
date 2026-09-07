-- Before / after remarks and structured photo buckets for after-sale custody
ALTER TABLE "erp_after_sale_item_movements"
  ADD COLUMN IF NOT EXISTS "before_remark" TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS "after_remark" TEXT NOT NULL DEFAULT '';

-- Normalize legacy flat photo_urls arrays into { before, after }
UPDATE "erp_after_sale_item_movements"
SET "photo_urls" = jsonb_build_object('before', "photo_urls", 'after', '[]'::jsonb)
WHERE jsonb_typeof("photo_urls") = 'array';
