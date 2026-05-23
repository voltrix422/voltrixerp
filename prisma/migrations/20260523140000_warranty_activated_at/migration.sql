ALTER TABLE "erp_warranties"
ADD COLUMN "activated_at" TIMESTAMP(3);

-- Existing sold rows: treat warranty start as activation date
UPDATE "erp_warranties"
SET "activated_at" = "warranty_start_date"
WHERE "customer_name" IS NOT NULL
  AND TRIM("customer_name") <> ''
  AND "activated_at" IS NULL;
