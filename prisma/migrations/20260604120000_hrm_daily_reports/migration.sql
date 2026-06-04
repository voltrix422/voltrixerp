-- CreateTable
CREATE TABLE "hrm_daily_reports" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT NOT NULL,
    "report_date" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'draft',
    "logs" JSONB NOT NULL DEFAULT '[]',
    "employee_notes" TEXT NOT NULL DEFAULT '',
    "admin_notes" TEXT NOT NULL DEFAULT '',
    "submitted_at" TIMESTAMP(3),
    "submitted_by" TEXT NOT NULL DEFAULT '',
    "reviewed_at" TIMESTAMP(3),
    "reviewed_by" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "hrm_daily_reports_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "hrm_daily_reports_staff_id_report_date_key" ON "hrm_daily_reports"("staff_id", "report_date");

-- CreateIndex
CREATE INDEX "hrm_daily_reports_report_date_status_idx" ON "hrm_daily_reports"("report_date", "status");

-- CreateIndex
CREATE INDEX "hrm_daily_reports_staff_id_idx" ON "hrm_daily_reports"("staff_id");

-- AddForeignKey
ALTER TABLE "hrm_daily_reports" ADD CONSTRAINT "hrm_daily_reports_staff_id_fkey" FOREIGN KEY ("staff_id") REFERENCES "erp_staff"("id") ON DELETE CASCADE ON UPDATE CASCADE;
