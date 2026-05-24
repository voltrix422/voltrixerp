-- Undo incorrect backfill: dispatch-pending rows are not activated until QR scan
UPDATE "erp_warranties"
SET "activated_at" = NULL
WHERE "activated_at" IS NOT NULL
  AND (
  (
    LOWER(COALESCE("notes", '')) LIKE '%pending%'
    AND LOWER(COALESCE("notes", '')) LIKE '%scan%'
  )
  OR (
    LOWER(COALESCE("notes", '')) LIKE '%dispatched on order%'
    AND LOWER(COALESCE("notes", '')) NOT LIKE '%warranty activated%'
  )
);
