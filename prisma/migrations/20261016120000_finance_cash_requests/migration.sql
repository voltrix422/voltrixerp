-- Employee cash / payment requests for admin finance approval
CREATE TABLE IF NOT EXISTS "erp_cash_requests" (
    "id" TEXT NOT NULL,
    "staff_id" TEXT,
    "user_id" TEXT NOT NULL,
    "requester_name" TEXT NOT NULL,
    "requester_email" TEXT NOT NULL DEFAULT '',
    "department" TEXT NOT NULL DEFAULT '',
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'PKR',
    "needed_on" TEXT NOT NULL,
    "purpose" TEXT NOT NULL,
    "category" TEXT NOT NULL DEFAULT 'Other',
    "payment_method" TEXT NOT NULL DEFAULT 'cash',
    "bank_name" TEXT NOT NULL DEFAULT '',
    "bank_account_number" TEXT NOT NULL DEFAULT '',
    "bank_account_title" TEXT NOT NULL DEFAULT '',
    "location" TEXT NOT NULL DEFAULT '',
    "item_breakdown" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT NOT NULL DEFAULT '',
    "attachment_url" TEXT NOT NULL DEFAULT '',
    "attachment_name" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'pending',
    "admin_notes" TEXT NOT NULL DEFAULT '',
    "reviewed_by" TEXT NOT NULL DEFAULT '',
    "reviewed_by_user_id" TEXT,
    "reviewed_at" TIMESTAMP(3),
    "finance_record_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "erp_cash_requests_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "erp_cash_requests_status_created_at_idx" ON "erp_cash_requests"("status", "created_at");
CREATE INDEX IF NOT EXISTS "erp_cash_requests_user_id_idx" ON "erp_cash_requests"("user_id");
CREATE INDEX IF NOT EXISTS "erp_cash_requests_staff_id_idx" ON "erp_cash_requests"("staff_id");
CREATE INDEX IF NOT EXISTS "erp_cash_requests_needed_on_idx" ON "erp_cash_requests"("needed_on");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'erp_cash_requests_staff_id_fkey'
  ) THEN
    ALTER TABLE "erp_cash_requests"
      ADD CONSTRAINT "erp_cash_requests_staff_id_fkey"
      FOREIGN KEY ("staff_id") REFERENCES "erp_staff"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END $$;
