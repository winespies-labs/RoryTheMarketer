import fs from "fs";
import path from "path";
import { getBrandDataDir, ensureBrandDataDir } from "@/lib/brands";
import type { InstagramResearchData, InstagramSearch } from "@/lib/instagram-research";
import { INSTAGRAM_RESEARCH_FILENAME } from "@/lib/instagram-research";

function storagePath(brandId: string): string {
  return path.join(getBrandDataDir(brandId), INSTAGRAM_RESEARCH_FILENAME);
}

export function readInstagramResearch(brandId: string): InstagramResearchData {
  const filePath = storagePath(brandId);
  if (!fs.existsSync(filePath)) return { updatedAt: "", searches: [] };
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw) as InstagramResearchData;
    return {
      updatedAt: data.updatedAt ?? "",
      searches: Array.isArray(data.searches) ? data.searches : [],
    };
  } catch {
    return { updatedAt: "", searches: [] };
  }
}

export function writeInstagramResearch(brandId: string, data: InstagramResearchData): void {
  ensureBrandDataDir(brandId);
  fs.writeFileSync(storagePath(brandId), JSON.stringify(data, null, 2), "utf-8");
}

export function addSearch(brandId: string, search: InstagramSearch): void {
  const data = readInstagramResearch(brandId);
  data.searches.unshift(search);
  data.updatedAt = new Date().toISOString();
  writeInstagramResearch(brandId, data);
}

export function deleteSearch(brandId: string, searchId: string): void {
  const data = readInstagramResearch(brandId);
  data.searches = data.searches.filter((s) => s.id !== searchId);
  data.updatedAt = new Date().toISOString();
  writeInstagramResearch(brandId, data);
}

export function updatePostTranscript(
  brandId: string,
  searchId: string,
  postId: string,
  transcript: string
): void {
  const data = readInstagramResearch(brandId);
  const search = data.searches.find((s) => s.id === searchId);
  if (!search) return;
  const post = search.posts.find((p) => p.id === postId);
  if (!post) return;
  post.transcript = transcript;
  post.transcribedAt = new Date().toISOString();
  data.updatedAt = new Date().toISOString();
  writeInstagramResearch(brandId, data);
}
