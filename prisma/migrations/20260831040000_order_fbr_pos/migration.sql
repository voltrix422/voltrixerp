-- FBR Digital Invoice fields for Branch POS orders. Defaults keep older rows blank.
ALTER TABLE "erp_orders" ADD COLUMN "fbr_status" TEXT NOT NULL DEFAULT '';
ALTER TABLE "erp_orders" ADD COLUMN "fbr_invoice_number" TEXT NOT NULL DEFAULT '';
ALTER TABLE "erp_orders" ADD COLUMN "fbr_qr" TEXT NOT NULL DEFAULT '';
ALTER TABLE "erp_orders" ADD COLUMN "fbr_error" TEXT NOT NULL DEFAULT '';
ALTER TABLE "erp_orders" ADD COLUMN "fbr_posted_at" TIMESTAMP(3);
