import fs from "fs";
import path from "path";
import { getBrandDataDir, ensureBrandDataDir } from "@/lib/brands";

export interface ReviewThemesData {
  generatedAt: string;
  summary: string;
}

const FILENAME = "review-themes.json";

function getFilePath(brandId: string): string {
  return path.join(getBrandDataDir(brandId), FILENAME);
}

export function readReviewThemes(brandId: string): ReviewThemesData | null {
  const filePath = getFilePath(brandId);
  if (!fs.existsSync(filePath)) return null;
  try {
    return JSON.parse(fs.readFileSync(filePath, "utf-8")) as ReviewThemesData;
  } catch {
    return null;
  }
}

export function writeReviewThemes(brandId: string, data: ReviewThemesData): void {
  ensureBrandDataDir(brandId);
  fs.writeFileSync(getFilePath(brandId), JSON.stringify(data, null, 2), "utf-8");
}
