-- CreateTable
CREATE TABLE "erp_china_money_transfers" (
    "id" TEXT NOT NULL,
    "amount" DOUBLE PRECISION NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'USD',
    "sent_at" TEXT NOT NULL,
    "method" TEXT NOT NULL DEFAULT '',
    "reference" TEXT NOT NULL DEFAULT '',
    "beneficiary" TEXT NOT NULL DEFAULT '',
    "notes" TEXT NOT NULL DEFAULT '',
    "proof_urls" JSONB NOT NULL DEFAULT '[]',
    "created_by" TEXT NOT NULL DEFAULT '',
    "created_by_id" TEXT NOT NULL DEFAULT '',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erp_china_money_transfers_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "erp_china_money_transfers_sent_at_idx" ON "erp_china_money_transfers"("sent_at");

-- CreateIndex
CREATE INDEX "erp_china_money_transfers_created_at_idx" ON "erp_china_money_transfers"("created_at");
