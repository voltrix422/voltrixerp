-- Loan tracking fields on finance records
ALTER TABLE "erp_finance_records" ADD COLUMN "loan_person" TEXT NOT NULL DEFAULT '';
ALTER TABLE "erp_finance_records" ADD COLUMN "loan_direction" TEXT NOT NULL DEFAULT '';
ALTER TABLE "erp_finance_records" ADD COLUMN "loan_parent_id" TEXT NOT NULL DEFAULT '';
