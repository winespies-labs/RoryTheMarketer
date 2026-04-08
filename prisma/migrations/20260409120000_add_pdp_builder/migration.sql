-- CreateTable: PDP Builder custom templates
CREATE TABLE "pdp_templates" (
    "id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "fields" JSONB NOT NULL,
    "thumbnail" TEXT,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "pdp_templates_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pdp_templates_brand_id_idx" ON "pdp_templates"("brand_id");

-- CreateTable: PDP Builder generated ads
CREATE TABLE "pdp_generated_ads" (
    "id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "sale_id" INTEGER NOT NULL,
    "template_id" TEXT NOT NULL,
    "wine_name" TEXT NOT NULL,
    "template_name" TEXT NOT NULL,
    "headline" TEXT NOT NULL,
    "primary_text" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "image_url" TEXT,
    "sale_url" TEXT NOT NULL,
    "status" TEXT NOT NULL DEFAULT 'saved',
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "pdp_generated_ads_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "pdp_generated_ads_brand_id_idx" ON "pdp_generated_ads"("brand_id");

-- CreateIndex
CREATE INDEX "pdp_generated_ads_brand_id_sale_id_idx" ON "pdp_generated_ads"("brand_id", "sale_id");
