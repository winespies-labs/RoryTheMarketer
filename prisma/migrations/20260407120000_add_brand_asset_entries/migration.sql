-- Brand asset library: image bytes in Postgres when DATABASE_URL is set (survives deploys)

CREATE TABLE "brand_asset_entries" (
    "id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "filename" TEXT,
    "image_data" BYTEA,
    "image_mime" TEXT,
    "original_name" TEXT,
    "uploaded_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "brand_asset_entries_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "brand_asset_entries_brand_id_idx" ON "brand_asset_entries"("brand_id");
