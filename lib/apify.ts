/**
 * Apify client for Instagram scraping.
 * Env: APIFY_API_TOKEN
 */

import { ApifyClient } from "apify-client";

let _client: ApifyClient | null = null;

function getClient(): ApifyClient {
  if (!_client) {
    const token = process.env.APIFY_API_TOKEN;
    if (!token?.trim()) throw new Error("APIFY_API_TOKEN is not set");
    _client = new ApifyClient({ token: token.trim() });
  }
  return _client;
}

export interface ApifyInstagramResult {
  shortCode: string;
  url: string;
  type: string;
  caption: string;
  ownerUsername: string;
  ownerFullName?: string;
  likesCount: number;
  commentsCount: number;
  videoViewCount?: number;
  videoUrl?: string;
  displayUrl: string;
  timestamp: string;
  hashtags?: string[];
  mentions?: string[];
}

export async function searchInstagram(
  keyword: string,
  options: { resultsLimit?: number } = {}
): Promise<ApifyInstagramResult[]> {
  const client = getClient();
  const limit = options.resultsLimit ?? 30;

  const run = await client.actor("apify/instagram-scraper").call({
    search: keyword,
    resultsType: "posts",
    resultsLimit: limit,
    searchType: "hashtag",
  });

  const { items } = await client.dataset(run.defaultDatasetId).listItems();

  return items.map((item) => ({
    shortCode: String(item.shortCode ?? item.id ?? ""),
    url: String(item.url ?? `https://www.instagram.com/p/${item.shortCode}/`),
    type: normalizeType(item.type),
    caption: String(item.caption ?? ""),
    ownerUsername: String(item.ownerUsername ?? item.ownerName ?? ""),
    ownerFullName: item.ownerFullName as string | undefined,
    likesCount: Number(item.likesCount ?? item.likes ?? 0),
    commentsCount: Number(item.commentsCount ?? item.comments ?? 0),
    videoViewCount: item.videoViewCount != null ? Number(item.videoViewCount) : undefined,
    videoUrl: (item.videoUrl as string) ?? undefined,
    displayUrl: String(item.displayUrl ?? item.imageUrl ?? item.thumbnailUrl ?? ""),
    timestamp: String(item.timestamp ?? item.takenAtTimestamp ?? item.date ?? ""),
    hashtags: Array.isArray(item.hashtags) ? item.hashtags.map(String) : undefined,
    mentions: Array.isArray(item.mentions) ? item.mentions.map(String) : undefined,
  }));
}

function normalizeType(type: unknown): "Image" | "Video" | "Sidecar" {
  const t = String(type ?? "").toLowerCase();
  if (t.includes("video")) return "Video";
  if (t.includes("sidecar") || t.includes("carousel")) return "Sidecar";
  return "Image";
}
