import fs from "fs";
import path from "path";
import { ensureBrandDataDir, getBrandDataDir } from "@/lib/brands";
import {
  META_COMMENTS_FILENAME,
  META_COMMENT_THEMES_FILENAME,
  type MetaCommentsData,
  type MetaCommentThemesData,
} from "@/lib/meta-comments";

function commentsPath(brandId: string): string {
  return path.join(getBrandDataDir(brandId), META_COMMENTS_FILENAME);
}

function themesPath(brandId: string): string {
  return path.join(getBrandDataDir(brandId), META_COMMENT_THEMES_FILENAME);
}

export function readMetaComments(brandId: string): MetaCommentsData | null {
  const filePath = commentsPath(brandId);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as MetaCommentsData;
    if (!parsed || !Array.isArray(parsed.comments)) return null;
    return {
      syncedAt: parsed.syncedAt ?? "",
      adIdToPostId: parsed.adIdToPostId ?? {},
      comments: parsed.comments ?? [],
    };
  } catch {
    return null;
  }
}

export function writeMetaComments(brandId: string, data: MetaCommentsData): void {
  ensureBrandDataDir(brandId);
  fs.writeFileSync(commentsPath(brandId), JSON.stringify(data, null, 2), "utf-8");
}

export function readMetaCommentThemes(brandId: string): MetaCommentThemesData | null {
  const filePath = themesPath(brandId);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as MetaCommentThemesData;
    if (!parsed || typeof parsed.summary !== "string") return null;
    return {
      generatedAt: parsed.generatedAt ?? "",
      scope: parsed.scope ?? {},
      summary: parsed.summary ?? "",
    };
  } catch {
    return null;
  }
}

export function writeMetaCommentThemes(brandId: string, data: MetaCommentThemesData): void {
  ensureBrandDataDir(brandId);
  fs.writeFileSync(themesPath(brandId), JSON.stringify(data, null, 2), "utf-8");
}

