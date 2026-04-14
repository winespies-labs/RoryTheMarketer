-- Meta Ads Manager snapshot tables (missing from initial migrations)
-- Uses IF NOT EXISTS so this is safe on DBs created via prisma db push

CREATE TABLE IF NOT EXISTS "meta_campaign_snapshots" (
    "id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "meta_campaign_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "effective_status" TEXT NOT NULL,
    "objective" TEXT,
    "daily_budget" TEXT,
    "lifetime_budget" TEXT,
    "insights" JSONB,
    "synced_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_campaign_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "meta_adset_snapshots" (
    "id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "meta_adset_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "effective_status" TEXT NOT NULL,
    "daily_budget" TEXT,
    "lifetime_budget" TEXT,
    "bid_strategy" TEXT,
    "bid_amount" TEXT,
    "insights" JSONB,
    "synced_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_adset_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "meta_ad_snapshots" (
    "id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "meta_ad_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "adset_id" TEXT NOT NULL,
    "campaign_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "effective_status" TEXT NOT NULL,
    "creative" JSONB,
    "insights" JSONB,
    "synced_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_ad_snapshots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "meta_daily_insights" (
    "id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "account_id" TEXT NOT NULL,
    "date" TEXT NOT NULL,
    "spend" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "revenue" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "roas" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "purchases" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cpa" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "clicks" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "impressions" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "ctr" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cpc" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "cpm" DOUBLE PRECISION NOT NULL DEFAULT 0,
    "fetched_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_daily_insights_pkey" PRIMARY KEY ("id")
);

CREATE TABLE IF NOT EXISTS "meta_sync_logs" (
    "id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "sync_type" TEXT NOT NULL,
    "status" TEXT NOT NULL,
    "campaign_count" INTEGER,
    "adset_count" INTEGER,
    "ad_count" INTEGER,
    "days_count" INTEGER,
    "error" TEXT,
    "completed_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "meta_sync_logs_pkey" PRIMARY KEY ("id")
);

-- Unique constraints
CREATE UNIQUE INDEX IF NOT EXISTS "meta_campaign_snapshots_brand_id_meta_campaign_id_key" ON "meta_campaign_snapshots"("brand_id", "meta_campaign_id");
CREATE UNIQUE INDEX IF NOT EXISTS "meta_adset_snapshots_brand_id_meta_adset_id_key" ON "meta_adset_snapshots"("brand_id", "meta_adset_id");
CREATE UNIQUE INDEX IF NOT EXISTS "meta_ad_snapshots_brand_id_meta_ad_id_key" ON "meta_ad_snapshots"("brand_id", "meta_ad_id");
CREATE UNIQUE INDEX IF NOT EXISTS "meta_daily_insights_brand_id_date_key" ON "meta_daily_insights"("brand_id", "date");

-- Indexes
CREATE INDEX IF NOT EXISTS "meta_campaign_snapshots_brand_id_idx" ON "meta_campaign_snapshots"("brand_id");
CREATE INDEX IF NOT EXISTS "meta_adset_snapshots_brand_id_idx" ON "meta_adset_snapshots"("brand_id");
CREATE INDEX IF NOT EXISTS "meta_adset_snapshots_campaign_id_idx" ON "meta_adset_snapshots"("campaign_id");
CREATE INDEX IF NOT EXISTS "meta_ad_snapshots_brand_id_idx" ON "meta_ad_snapshots"("brand_id");
CREATE INDEX IF NOT EXISTS "meta_ad_snapshots_campaign_id_idx" ON "meta_ad_snapshots"("campaign_id");
CREATE INDEX IF NOT EXISTS "meta_daily_insights_brand_id_date_idx" ON "meta_daily_insights"("brand_id", "date");
CREATE INDEX IF NOT EXISTS "meta_sync_logs_brand_id_idx" ON "meta_sync_logs"("brand_id");
