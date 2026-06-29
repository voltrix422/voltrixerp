-- CreateTable
CREATE TABLE "erp_crm_product_prices" (
    "id" TEXT NOT NULL,
    "model" TEXT NOT NULL,
    "display_name" TEXT NOT NULL DEFAULT '',
    "retail_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "wholesale_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "dealership_price" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "updated_by" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erp_crm_product_prices_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "erp_crm_product_prices_model_key" ON "erp_crm_product_prices"("model");
