ALTER TABLE "erp_clients"
ADD COLUMN "owner_user_id" TEXT;

ALTER TABLE "erp_orders"
ADD COLUMN "owner_user_id" TEXT;

ALTER TABLE "crm_quotations"
ADD COLUMN "owner_user_id" TEXT;
