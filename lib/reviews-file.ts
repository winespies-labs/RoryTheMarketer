import fs from "fs";
import path from "path";
import { getBrandDataDir, ensureBrandDataDir } from "@/lib/brands";
import type { ReviewsData } from "@/lib/reviews";
import { REVIEWS_FILENAME } from "@/lib/reviews";

function getFilePath(brandId: string): string {
  return path.join(getBrandDataDir(brandId), REVIEWS_FILENAME);
}

export function defaultReviewsFileData(): ReviewsData {
  return { updatedAt: new Date().toISOString(), reviews: [] };
}

/** JSON file fallback when DATABASE_URL is unset */
export function readReviewsFile(brandId: string): ReviewsData {
  const filePath = getFilePath(brandId);
  if (!fs.existsSync(filePath)) return defaultReviewsFileData();
  const raw = fs.readFileSync(filePath, "utf-8");
  try {
    const data = JSON.parse(raw) as ReviewsData;
    if (!Array.isArray(data?.reviews)) return defaultReviewsFileData();
    return {
      updatedAt: data.updatedAt ?? new Date().toISOString(),
      slackChannelId: data.slackChannelId,
      reviews: data.reviews,
    };
  } catch {
    return defaultReviewsFileData();
  }
}

export function writeReviewsFile(brandId: string, data: ReviewsData): void {
  ensureBrandDataDir(brandId);
  const next: ReviewsData = {
    ...data,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(
    getFilePath(brandId),
    JSON.stringify(next, null, 2),
    "utf-8"
  );
}
