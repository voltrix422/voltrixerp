-- AlterTable
ALTER TABLE "erp_staff" ADD COLUMN IF NOT EXISTS "tax_enabled" BOOLEAN NOT NULL DEFAULT false;

-- Enable tax for staff who already have a tax amount set.
UPDATE "erp_staff" SET "tax_enabled" = true WHERE "tax_amount" > 0;
