-- CreateTable
CREATE TABLE "erp_pos_terminals" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "location" TEXT NOT NULL DEFAULT '',
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "erp_pos_terminals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "erp_pos_sales" (
    "id" TEXT NOT NULL,
    "receipt_number" TEXT NOT NULL,
    "terminal_id" TEXT NOT NULL,
    "terminal_name" TEXT NOT NULL DEFAULT '',
    "items" JSONB NOT NULL DEFAULT '[]',
    "subtotal" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "discount" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "tax" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "total" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "payment_method" TEXT NOT NULL DEFAULT 'cash',
    "cashier_id" TEXT NOT NULL DEFAULT '',
    "cashier_name" TEXT NOT NULL DEFAULT '',
    "customer_name" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "erp_pos_sales_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "erp_pos_terminals_code_key" ON "erp_pos_terminals"("code");

-- CreateIndex
CREATE INDEX "erp_pos_sales_terminal_id_created_at_idx" ON "erp_pos_sales"("terminal_id", "created_at");
