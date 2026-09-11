-- Admin-assigned todos with user updates + attachments
CREATE TABLE IF NOT EXISTS "erp_todos" (
    "id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL DEFAULT '',
    "cadence" TEXT NOT NULL DEFAULT 'once',
    "due_at" TIMESTAMP(3),
    "assignee_user_id" TEXT NOT NULL,
    "assignee_name" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'open',
    "assigned_by" TEXT NOT NULL DEFAULT '',
    "assigned_by_id" TEXT,
    "assigned_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completed_at" TIMESTAMP(3),
    "completed_by" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "erp_todos_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "erp_todos_assignee_user_id_idx" ON "erp_todos"("assignee_user_id");
CREATE INDEX IF NOT EXISTS "erp_todos_status_idx" ON "erp_todos"("status");
CREATE INDEX IF NOT EXISTS "erp_todos_cadence_idx" ON "erp_todos"("cadence");
CREATE INDEX IF NOT EXISTS "erp_todos_due_at_idx" ON "erp_todos"("due_at");
CREATE INDEX IF NOT EXISTS "erp_todos_assigned_at_idx" ON "erp_todos"("assigned_at");

CREATE TABLE IF NOT EXISTS "erp_todo_updates" (
    "id" TEXT NOT NULL,
    "todo_id" TEXT NOT NULL,
    "message" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'in_progress',
    "attachment_urls" JSONB NOT NULL DEFAULT '[]',
    "created_by" TEXT NOT NULL DEFAULT '',
    "created_by_user_id" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "erp_todo_updates_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "erp_todo_updates_todo_id_idx" ON "erp_todo_updates"("todo_id");
CREATE INDEX IF NOT EXISTS "erp_todo_updates_created_at_idx" ON "erp_todo_updates"("created_at");

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'erp_todo_updates_todo_id_fkey'
  ) THEN
    ALTER TABLE "erp_todo_updates"
      ADD CONSTRAINT "erp_todo_updates_todo_id_fkey"
      FOREIGN KEY ("todo_id") REFERENCES "erp_todos"("id")
      ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END $$;
