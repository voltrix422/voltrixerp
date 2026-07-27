-- Public website analytics (pageviews, feature dwell, live presence)

CREATE TABLE IF NOT EXISTS "erp_website_pageviews" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "title" TEXT NOT NULL DEFAULT '',
    "referrer" TEXT NOT NULL DEFAULT '',
    "visitor_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "user_agent" TEXT NOT NULL DEFAULT '',
    "ip_hash" TEXT NOT NULL DEFAULT '',
    "duration_ms" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "erp_website_pageviews_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "erp_website_pageviews_created_at_idx" ON "erp_website_pageviews"("created_at");
CREATE INDEX IF NOT EXISTS "erp_website_pageviews_path_created_at_idx" ON "erp_website_pageviews"("path", "created_at");
CREATE INDEX IF NOT EXISTS "erp_website_pageviews_visitor_id_created_at_idx" ON "erp_website_pageviews"("visitor_id", "created_at");
CREATE INDEX IF NOT EXISTS "erp_website_pageviews_session_id_idx" ON "erp_website_pageviews"("session_id");

CREATE TABLE IF NOT EXISTS "erp_website_feature_hits" (
    "id" TEXT NOT NULL,
    "path" TEXT NOT NULL,
    "feature_key" TEXT NOT NULL,
    "feature_label" TEXT NOT NULL DEFAULT '',
    "visitor_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "duration_ms" INTEGER NOT NULL DEFAULT 0,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "erp_website_feature_hits_pkey" PRIMARY KEY ("id")
);

CREATE INDEX IF NOT EXISTS "erp_website_feature_hits_created_at_idx" ON "erp_website_feature_hits"("created_at");
CREATE INDEX IF NOT EXISTS "erp_website_feature_hits_feature_key_created_at_idx" ON "erp_website_feature_hits"("feature_key", "created_at");
CREATE INDEX IF NOT EXISTS "erp_website_feature_hits_path_created_at_idx" ON "erp_website_feature_hits"("path", "created_at");
CREATE INDEX IF NOT EXISTS "erp_website_feature_hits_visitor_id_created_at_idx" ON "erp_website_feature_hits"("visitor_id", "created_at");

CREATE TABLE IF NOT EXISTS "erp_website_presence" (
    "id" TEXT NOT NULL,
    "visitor_id" TEXT NOT NULL,
    "session_id" TEXT NOT NULL,
    "path" TEXT NOT NULL DEFAULT '/',
    "user_agent" TEXT NOT NULL DEFAULT '',
    "ip_hash" TEXT NOT NULL DEFAULT '',
    "last_seen_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "erp_website_presence_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX IF NOT EXISTS "erp_website_presence_visitor_id_key" ON "erp_website_presence"("visitor_id");
CREATE INDEX IF NOT EXISTS "erp_website_presence_last_seen_at_idx" ON "erp_website_presence"("last_seen_at");
