-- AddColumn
ALTER TABLE "customer_reviews"
    ADD COLUMN "usp_category" TEXT,
    ADD COLUMN "ad_score" INTEGER,
    ADD COLUMN "extracted_quote" TEXT,
    ADD COLUMN "scored_at" TIMESTAMP(3);
