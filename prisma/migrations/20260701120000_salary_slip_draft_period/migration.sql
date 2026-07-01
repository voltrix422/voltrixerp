ALTER TABLE "erp_salary_slips" ADD COLUMN IF NOT EXISTS "status" TEXT NOT NULL DEFAULT 'finalized';
ALTER TABLE "erp_salary_slips" ADD COLUMN IF NOT EXISTS "period_start" TEXT;
ALTER TABLE "erp_salary_slips" ADD COLUMN IF NOT EXISTS "period_end" TEXT;
ALTER TABLE "erp_salary_slips" ADD COLUMN IF NOT EXISTS "staff_local_id" TEXT;

CREATE INDEX IF NOT EXISTS "erp_salary_slips_staff_local_id_month_idx" ON "erp_salary_slips"("staff_local_id", "month");
