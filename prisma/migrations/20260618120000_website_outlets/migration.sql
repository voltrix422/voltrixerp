-- CreateTable
CREATE TABLE "erp_website_outlets" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "city" TEXT NOT NULL DEFAULT '',
    "address" TEXT NOT NULL DEFAULT '',
    "phone" TEXT NOT NULL DEFAULT '',
    "email" TEXT NOT NULL DEFAULT '',
    "manager" TEXT NOT NULL DEFAULT '',
    "opening_hours" TEXT NOT NULL DEFAULT '',
    "map_url" TEXT NOT NULL DEFAULT '',
    "published" BOOLEAN NOT NULL DEFAULT false,
    "sort_order" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "created_by" TEXT,

    CONSTRAINT "erp_website_outlets_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "erp_website_outlets_published_sort_order_idx" ON "erp_website_outlets"("published", "sort_order");
