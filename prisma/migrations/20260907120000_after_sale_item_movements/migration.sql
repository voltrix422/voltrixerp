-- After-sale custody: item in / item out for batteries brought for service
CREATE TABLE IF NOT EXISTS "erp_after_sale_item_movements" (
    "id" TEXT NOT NULL,
    "movement_type" TEXT NOT NULL,
    "ticket_id" TEXT,
    "ticket_number" TEXT,
    "serial_number" TEXT NOT NULL,
    "product_name" TEXT NOT NULL DEFAULT '',
    "model" TEXT NOT NULL DEFAULT '',
    "condition" TEXT NOT NULL DEFAULT 'unknown',
    "customer_name" TEXT NOT NULL DEFAULT '',
    "customer_phone" TEXT,
    "notes" TEXT NOT NULL DEFAULT '',
    "status" TEXT NOT NULL DEFAULT 'held',
    "linked_in_id" TEXT,
    "disposition" TEXT NOT NULL DEFAULT '',
    "out_serial_number" TEXT,
    "photo_urls" JSONB NOT NULL DEFAULT '[]',
    "created_by" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "erp_after_sale_item_movements_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "erp_after_sale_item_movements_ticket_id_idx"
  ON "erp_after_sale_item_movements"("ticket_id");
CREATE INDEX IF NOT EXISTS "erp_after_sale_item_movements_serial_number_idx"
  ON "erp_after_sale_item_movements"("serial_number");
CREATE INDEX IF NOT EXISTS "erp_after_sale_item_movements_movement_type_status_idx"
  ON "erp_after_sale_item_movements"("movement_type", "status");
