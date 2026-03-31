-- CreateTable
CREATE TABLE "context_library_entries" (
    "id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "title" TEXT,
    "content" TEXT NOT NULL,
    "meta" JSONB,
    "tags" JSONB,
    "added_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "context_library_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "context_library_entries_brand_id_idx" ON "context_library_entries"("brand_id");

-- CreateTable
CREATE TABLE "swipe_inspiration_entries" (
    "id" TEXT NOT NULL,
    "brand_id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "content" TEXT NOT NULL,
    "title" TEXT,
    "style" TEXT,
    "category" TEXT,
    "tags" JSONB,
    "image_file" TEXT,
    "image_data" BYTEA,
    "image_mime" TEXT,
    "use_in_context" BOOLEAN NOT NULL DEFAULT false,
    "added_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "swipe_inspiration_entries_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "swipe_inspiration_entries_brand_id_idx" ON "swipe_inspiration_entries"("brand_id");
