-- AlterTable
ALTER TABLE "writeups" ADD COLUMN "status" TEXT NOT NULL DEFAULT 'draft';
ALTER TABLE "writeups" ADD COLUMN "score" INTEGER;
