ALTER TABLE "erp_orders"
ADD COLUMN "fulfillment_dispatcher" TEXT,
ADD COLUMN "fulfillment_receiver_name" TEXT,
ADD COLUMN "fulfillment_receiver_cnic" TEXT,
ADD COLUMN "fulfillment_vehicle_number" TEXT,
ADD COLUMN "fulfillment_date" TEXT,
ADD COLUMN "fulfillment_receiver_image_url" TEXT,
ADD COLUMN "fulfillment_receiver_cnic_image_url" TEXT,
ADD COLUMN "fulfillment_vehicle_image_url" TEXT,
ADD COLUMN "fulfillment_product_image_urls" JSONB NOT NULL DEFAULT '[]';
