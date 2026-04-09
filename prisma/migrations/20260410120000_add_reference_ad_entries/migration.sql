-- Reference ad templates: persist markdown + image bytes in Postgres so they survive Railway deploys

CREATE TABLE "reference_ad_entries" (
    "id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "brand" TEXT NOT NULL,
    "markdown" TEXT NOT NULL,
    "image_data" BYTEA,
    "image_mime" TEXT,
    "image_filename" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "reference_ad_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "reference_ad_entries_brand_idx" ON "reference_ad_entries"("brand");
