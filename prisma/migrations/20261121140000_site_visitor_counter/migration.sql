-- CreateTable
CREATE TABLE "erp_site_visitor_counter" (
    "id" TEXT NOT NULL,
    "count" INTEGER NOT NULL DEFAULT 0,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "erp_site_visitor_counter_pkey" PRIMARY KEY ("id")
);

-- Seed the single counter row
INSERT INTO "erp_site_visitor_counter" ("id", "count", "updated_at")
VALUES ('main', 0, CURRENT_TIMESTAMP);
