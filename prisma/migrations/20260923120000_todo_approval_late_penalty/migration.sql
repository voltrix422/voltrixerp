-- To-do admin approval, due-date extension, and late-submission point tracking
ALTER TABLE "erp_todos" ADD COLUMN IF NOT EXISTS "submitted_at" TIMESTAMP(3);
ALTER TABLE "erp_todos" ADD COLUMN IF NOT EXISTS "approved_at" TIMESTAMP(3);
ALTER TABLE "erp_todos" ADD COLUMN IF NOT EXISTS "approved_by" TEXT NOT NULL DEFAULT '';
ALTER TABLE "erp_todos" ADD COLUMN IF NOT EXISTS "approved_by_id" TEXT;
ALTER TABLE "erp_todos" ADD COLUMN IF NOT EXISTS "late_penalty_points" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "erp_todos" ADD COLUMN IF NOT EXISTS "late_penalty_at" TIMESTAMP(3);
ALTER TABLE "erp_todos" ADD COLUMN IF NOT EXISTS "extended_at" TIMESTAMP(3);
ALTER TABLE "erp_todos" ADD COLUMN IF NOT EXISTS "extended_by" TEXT NOT NULL DEFAULT '';
