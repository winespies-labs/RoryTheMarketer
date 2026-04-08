-- Customer reviews in Postgres when DATABASE_URL is set (with JSON import on first load)

CREATE TABLE "customer_reviews" (
    "id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "source" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "author" TEXT,
    "rating" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL,
    "slack_message_ts" TEXT,
    "starred" BOOLEAN NOT NULL DEFAULT false,
    "topics" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[],

    CONSTRAINT "customer_reviews_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "customer_reviews_brand_id_slack_message_ts_key" ON "customer_reviews"("brand_id", "slack_message_ts");

CREATE INDEX "customer_reviews_brand_id_idx" ON "customer_reviews"("brand_id");
CREATE INDEX "customer_reviews_brand_id_starred_idx" ON "customer_reviews"("brand_id", "starred");

CREATE TABLE "brand_review_meta" (
    "brand_id" TEXT NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,
    "slack_channel_id" TEXT,

    CONSTRAINT "brand_review_meta_pkey" PRIMARY KEY ("brand_id")
);
