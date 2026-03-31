-- CreateTable
CREATE TABLE "writeups" (
    "id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "writeups_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "writeups_brand_id_idx" ON "writeups"("brand_id");
