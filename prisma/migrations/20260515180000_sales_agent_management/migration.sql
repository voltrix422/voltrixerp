-- ErpUser sales fields
ALTER TABLE "erp_users" ADD COLUMN IF NOT EXISTS "manager_id" TEXT;
ALTER TABLE "erp_users" ADD COLUMN IF NOT EXISTS "location" TEXT NOT NULL DEFAULT '';
ALTER TABLE "erp_users" ADD COLUMN IF NOT EXISTS "job_title" TEXT NOT NULL DEFAULT 'field_sales_officer';
ALTER TABLE "erp_users" ADD COLUMN IF NOT EXISTS "base_salary" DOUBLE PRECISION NOT NULL DEFAULT 25000;
ALTER TABLE "erp_users" ADD COLUMN IF NOT EXISTS "commission_percent" DOUBLE PRECISION NOT NULL DEFAULT 0.5;

CREATE INDEX IF NOT EXISTS "erp_users_role_idx" ON "erp_users"("role");
CREATE INDEX IF NOT EXISTS "erp_users_manager_id_idx" ON "erp_users"("manager_id");

-- Compensation history
CREATE TABLE IF NOT EXISTS "erp_sales_agent_compensation_history" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "base_salary" DOUBLE PRECISION NOT NULL,
    "commission_percent" DOUBLE PRECISION NOT NULL,
    "effective_from" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "note" TEXT NOT NULL DEFAULT '',
    "created_by" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT "erp_sales_agent_compensation_history_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "erp_sales_agent_compensation_history_user_id_effective_from_idx" ON "erp_sales_agent_compensation_history"("user_id", "effective_from");

-- Order commission
ALTER TABLE "erp_orders" ADD COLUMN IF NOT EXISTS "sales_agent_commission_percent" DOUBLE PRECISION;
ALTER TABLE "erp_orders" ADD COLUMN IF NOT EXISTS "sales_agent_commission_amount" DOUBLE PRECISION;
