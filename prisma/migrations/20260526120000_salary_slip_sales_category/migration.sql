-- AlterTable
ALTER TABLE "erp_salary_slips" ADD COLUMN "user_id" TEXT;
ALTER TABLE "erp_salary_slips" ADD COLUMN "staff_category" TEXT NOT NULL DEFAULT 'hrm';

-- CreateIndex
CREATE INDEX "erp_salary_slips_staff_category_month_idx" ON "erp_salary_slips"("staff_category", "month");
CREATE INDEX "erp_salary_slips_user_id_month_idx" ON "erp_salary_slips"("user_id", "month");
