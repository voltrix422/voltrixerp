-- HRM KPI templates, staff assignments, weekly settlements
ALTER TABLE "erp_staff" ADD COLUMN IF NOT EXISTS "erp_user_id" TEXT;

CREATE INDEX IF NOT EXISTS "erp_staff_email_idx" ON "erp_staff"("email");
CREATE INDEX IF NOT EXISTS "erp_staff_erp_user_id_idx" ON "erp_staff"("erp_user_id");

CREATE TABLE IF NOT EXISTS "hrm_kpi_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "unit" TEXT NOT NULL DEFAULT 'count',
    "default_target" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "default_weight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "period_type" TEXT NOT NULL DEFAULT 'weekly',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_by" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hrm_kpi_templates_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "hrm_staff_kpis" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "template_id" TEXT,
    "name" TEXT NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'count',
    "target_value" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "weight" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "period_type" TEXT NOT NULL DEFAULT 'weekly',
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT NOT NULL DEFAULT '',
    "assigned_by" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "hrm_staff_kpis_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "hrm_kpi_settlements" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "period_type" TEXT NOT NULL DEFAULT 'weekly',
    "period_start" TEXT NOT NULL,
    "period_end" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "entries" JSONB NOT NULL DEFAULT '[]',
    "weighted_score" DOUBLE PRECISION,
    "employee_notes" TEXT NOT NULL DEFAULT '',
    "admin_notes" TEXT NOT NULL DEFAULT '',
    "submitted_at" TIMESTAMP(3),
    "submitted_by" TEXT NOT NULL DEFAULT '',
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hrm_kpi_settlements_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "hrm_kpi_settlements_staff_id_period_start_period_end_key"
ON "hrm_kpi_settlements"("staff_id", "period_start", "period_end");

CREATE INDEX IF NOT EXISTS "hrm_staff_kpis_staff_id_idx" ON "hrm_staff_kpis"("staff_id");
CREATE INDEX IF NOT EXISTS "hrm_staff_kpis_template_id_idx" ON "hrm_staff_kpis"("template_id");
CREATE INDEX IF NOT EXISTS "hrm_kpi_settlements_staff_id_status_idx" ON "hrm_kpi_settlements"("staff_id", "status");

DO $$ BEGIN
  ALTER TABLE "hrm_staff_kpis" ADD CONSTRAINT "hrm_staff_kpis_staff_id_fkey"
    FOREIGN KEY ("staff_id") REFERENCES "erp_staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "hrm_staff_kpis" ADD CONSTRAINT "hrm_staff_kpis_template_id_fkey"
    FOREIGN KEY ("template_id") REFERENCES "hrm_kpi_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

DO $$ BEGIN
  ALTER TABLE "hrm_kpi_settlements" ADD CONSTRAINT "hrm_kpi_settlements_staff_id_fkey"
    FOREIGN KEY ("staff_id") REFERENCES "erp_staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
