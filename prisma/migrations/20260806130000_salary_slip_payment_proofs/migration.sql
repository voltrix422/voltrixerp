-- AlterTable
ALTER TABLE "erp_salary_slips" ADD COLUMN IF NOT EXISTS "paid_at" TIMESTAMP(3);
ALTER TABLE "erp_salary_slips" ADD COLUMN IF NOT EXISTS "paid_by" TEXT;
ALTER TABLE "erp_salary_slips" ADD COLUMN IF NOT EXISTS "payment_notes" TEXT NOT NULL DEFAULT '';
ALTER TABLE "erp_salary_slips" ADD COLUMN IF NOT EXISTS "payment_attachments" JSONB NOT NULL DEFAULT '[]';
