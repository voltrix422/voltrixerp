CREATE TABLE IF NOT EXISTS "erp_purchase_scopes" (
  "id" TEXT NOT NULL,
  "name" TEXT NOT NULL,
  "active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "erp_purchase_scopes_pkey" PRIMARY KEY ("id")
);

INSERT INTO "erp_purchase_scopes" ("id", "name", "active", "created_at", "updated_at")
VALUES
  ('P1', 'Main Office', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('P2', 'Attock', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP),
  ('P3', 'Wah Cantt', true, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
ON CONFLICT ("id") DO NOTHING;
