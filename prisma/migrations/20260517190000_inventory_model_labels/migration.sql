CREATE TABLE IF NOT EXISTS "erp_inventory_model_labels" (
  "id" TEXT NOT NULL,
  "model" TEXT NOT NULL,
  "display_name" TEXT NOT NULL DEFAULT '',
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "erp_inventory_model_labels_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "erp_inventory_model_labels_model_key"
  ON "erp_inventory_model_labels"("model");
