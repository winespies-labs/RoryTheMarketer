import { nanoid } from "nanoid";
import { useDatabase } from "@/lib/database";
import {
  importJsonToDbIfEmpty,
  listReviewsFromDb,
  loadReviewsFromDb,
  mergeReviewsDb,
  updateReviewMetadataDb,
  type ListReviewsFilters,
} from "@/lib/reviews-db";
import { readReviewsFile, writeReviewsFile } from "@/lib/reviews-file";
import {
  type Review,
  type ReviewsData,
  type ReviewSource,
} from "@/lib/reviews";
import type { SlackMessage } from "@/lib/slack";

export type { ListReviewsFilters };

/**
 * Load all reviews + meta (file or Postgres). Prefer DATABASE_URL when set;
 * one-time import from `data/{brand}/reviews.json` if the DB table is empty.
 */
export async function loadReviews(brandId: string): Promise<ReviewsData> {
  if (useDatabase()) {
    await importJsonToDbIfEmpty(brandId);
    return loadReviewsFromDb(brandId);
  }
  return readReviewsFile(brandId);
}

export async function formatReviewSnippetsForPrompt(
  brandId: string,
  options?: { limit?: number; maxCharsPerReview?: number }
): Promise<string> {
  const limit = options?.limit ?? 12;
  const maxChars = options?.maxCharsPerReview ?? 200;
  const { reviews: raw } = await loadReviews(brandId);
  const reviews = [...raw].sort((a, b) => {
    if (!!a.starred !== !!b.starred) return a.starred ? -1 : 1;
    return 0;
  });
  const lines = reviews.slice(0, limit).map((r) => {
    const titlePrefix = r.title ? `"${r.title}" ` : "";
    const body =
      r.content.slice(0, maxChars) + (r.content.length > maxChars ? "…" : "");
    return `- ${titlePrefix}${body}`;
  });
  if (lines.length === 0) return "";
  return (
    `\n\n## Sample customer reviews (use for proof, quotes, or language)\n\n` +
    lines.join("\n") +
    `\n`
  );
}

function mergeReviewsFile(
  brandId: string,
  incoming: Omit<Review, "id">[],
  options?: { slackChannelId?: string }
): { added: number; total: number } {
  const data = readReviewsFile(brandId);
  const existingByTs = new Set(
    data.reviews.map((r) => r.slackMessageTs).filter(Boolean)
  );
  const existingIds = new Set(data.reviews.map((r) => r.id));
  let added = 0;
  for (const r of incoming) {
    if (r.slackMessageTs && existingByTs.has(r.slackMessageTs)) continue;
    let id = nanoid();
    while (existingIds.has(id)) id = nanoid();
    existingIds.add(id);
    if (r.slackMessageTs) existingByTs.add(r.slackMessageTs);
    data.reviews.push({
      ...r,
      id,
      title: r.title || undefined,
      author: r.author || undefined,
      rating: r.rating ?? undefined,
    });
    added++;
  }
  if (options?.slackChannelId) data.slackChannelId = options.slackChannelId;
  writeReviewsFile(brandId, data);
  return { added, total: data.reviews.length };
}

export async function mergeReviews(
  brandId: string,
  incoming: Omit<Review, "id">[],
  options?: { slackChannelId?: string }
): Promise<{ added: number; total: number }> {
  if (useDatabase()) {
    await importJsonToDbIfEmpty(brandId);
    return mergeReviewsDb(brandId, incoming, options);
  }
  return mergeReviewsFile(brandId, incoming, options);
}

function normalizeTopicList(topics: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const t of topics) {
    const s = t.trim();
    if (!s) continue;
    const key = s.toLowerCase();
    if (seen.has(key)) continue;
    seen.add(key);
    out.push(s);
  }
  return out;
}

function updateReviewMetadataFile(
  brandId: string,
  reviewId: string,
  patch: { starred?: boolean; topics?: string[] }
): Review | null {
  const data = readReviewsFile(brandId);
  const idx = data.reviews.findIndex((r) => r.id === reviewId);
  if (idx === -1) return null;
  const cur = data.reviews[idx];
  const next: Review = { ...cur };
  if (patch.starred !== undefined) next.starred = patch.starred;
  if (patch.topics !== undefined) next.topics = normalizeTopicList(patch.topics);
  data.reviews[idx] = next;
  writeReviewsFile(brandId, data);
  return next;
}

export async function updateReviewMetadata(
  brandId: string,
  reviewId: string,
  patch: { starred?: boolean; topics?: string[] }
): Promise<Review | null> {
  if (useDatabase()) {
    await importJsonToDbIfEmpty(brandId);
    return updateReviewMetadataDb(brandId, reviewId, patch);
  }
  return updateReviewMetadataFile(brandId, reviewId, patch);
}

export function collectDistinctTopics(reviews: Review[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const r of reviews) {
    for (const t of r.topics ?? []) {
      const s = t.trim();
      if (!s) continue;
      const key = s.toLowerCase();
      if (seen.has(key)) continue;
      seen.add(key);
      out.push(s);
    }
  }
  out.sort((a, b) => a.localeCompare(b, undefined, { sensitivity: "base" }));
  return out;
}

export async function listReviewsForApi(
  brandId: string,
  filters: ListReviewsFilters
): Promise<{
  page: Review[];
  storeTotal: number;
  matchCount: number;
  topicsInUse: string[];
  updatedAt: string;
  slackChannelId?: string;
}> {
  if (useDatabase()) {
    await importJsonToDbIfEmpty(brandId);
    return listReviewsFromDb(brandId, filters);
  }
  const data = readReviewsFile(brandId);
  let reviews = data.reviews;
  const q = filters.q?.toLowerCase().trim();
  if (q) {
    reviews = reviews.filter(
      (r) =>
        (r.title?.toLowerCase().includes(q) ?? false) ||
        r.content.toLowerCase().includes(q)
    );
  }
  const topic = filters.topic?.trim();
  if (topic) {
    const tk = topic.toLowerCase();
    reviews = reviews.filter((r) =>
      (r.topics ?? []).some((t) => t.toLowerCase() === tk)
    );
  }
  if (filters.starredOnly) {
    reviews = reviews.filter((r) => !!r.starred);
  }
  const matchCount = reviews.length;
  const page = reviews.slice(
    filters.offset,
    filters.offset + filters.limit
  );
  return {
    page,
    storeTotal: data.reviews.length,
    matchCount,
    topicsInUse: collectDistinctTopics(data.reviews),
    updatedAt: data.updatedAt,
    slackChannelId: data.slackChannelId,
  };
}

export function inferSource(text: string): ReviewSource {
  const lower = text.toLowerCase();
  if (lower.includes("trustpilot")) return "trustpilot";
  if (lower.includes("app store") || lower.includes("appstore"))
    return "app_store";
  return "unknown";
}

function parseStars(footer?: string): number | undefined {
  if (!footer) return undefined;
  const stars = (footer.match(/★/g) || []).length;
  return stars > 0 ? stars : undefined;
}

export function parseSlackMessage(msg: SlackMessage): Omit<Review, "id"> {
  const att = msg.attachments?.[0];

  if (att?.text) {
    const source = inferSource(att.footer ?? att.fallback ?? "trustpilot");
    return {
      source,
      title: att.title || att.fallback || undefined,
      content: att.text,
      author: att.author_name || undefined,
      rating: parseStars(att.footer),
      createdAt: new Date().toISOString(),
      slackMessageTs: msg.ts,
    };
  }

  const text = msg.text.trim();
  const source = inferSource(text);
  const firstLine = text.split(/\r?\n/)[0] ?? "";
  const useFirstLineAsTitle =
    firstLine.length > 0 &&
    firstLine.length <= 120 &&
    !firstLine.startsWith("http");
  const title = useFirstLineAsTitle ? firstLine : undefined;
  const content = useFirstLineAsTitle
    ? text.slice(firstLine.length).trimStart()
    : text;
  return {
    source,
    title: title || undefined,
    content: content || text,
    createdAt: new Date().toISOString(),
    slackMessageTs: msg.ts,
  };
}
