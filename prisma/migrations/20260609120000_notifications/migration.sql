-- AlterTable
ALTER TABLE "erp_users" ADD COLUMN "notification_emails" JSONB NOT NULL DEFAULT '[]';
ALTER TABLE "erp_users" ADD COLUMN "email_notifications_enabled" BOOLEAN NOT NULL DEFAULT true;

-- CreateTable
CREATE TABLE "erp_notifications" (
    "id" TEXT NOT NULL,
    "user_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "message" TEXT NOT NULL DEFAULT '',
    "type" TEXT NOT NULL DEFAULT 'info',
    "link" TEXT NOT NULL DEFAULT '',
    "read" BOOLEAN NOT NULL DEFAULT false,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "erp_notifications_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "erp_notifications_user_id_read_idx" ON "erp_notifications"("user_id", "read");
CREATE INDEX "erp_notifications_user_id_created_at_idx" ON "erp_notifications"("user_id", "created_at");
