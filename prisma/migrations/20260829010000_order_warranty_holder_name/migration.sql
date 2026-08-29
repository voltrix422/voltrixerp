-- Person/company name that must be typed to start warranty (not the CRM client/dealer)
ALTER TABLE "erp_orders" ADD COLUMN "warranty_holder_name" TEXT NOT NULL DEFAULT '';
