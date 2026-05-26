-- CreateTable
CREATE TABLE "erp_manual_inventory_item" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "qty" DOUBLE PRECISION NOT NULL,
    "available_qty" DOUBLE PRECISION NOT NULL,
    "unit" TEXT NOT NULL DEFAULT 'pcs',
    "notes" TEXT NOT NULL DEFAULT '',
    "inventory_stock_id" TEXT,
    "created_by" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erp_manual_inventory_item_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "erp_manual_inventory_item_model_key" ON "erp_manual_inventory_item"("model");
