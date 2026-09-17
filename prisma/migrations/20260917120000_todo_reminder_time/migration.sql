-- Recurring to-do reminder time (Pakistan) and last fire stamp
ALTER TABLE "erp_todos" ADD COLUMN IF NOT EXISTS "reminder_time" TEXT NOT NULL DEFAULT '';
ALTER TABLE "erp_todos" ADD COLUMN IF NOT EXISTS "last_reminded_at" TIMESTAMP(3);
