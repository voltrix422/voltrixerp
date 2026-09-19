-- Internal CRM referrer name. Not used on invoices or customer PDFs.
ALTER TABLE "erp_orders" ADD COLUMN "referrer_name" TEXT NOT NULL DEFAULT '';
