import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { getBrandDataDir, ensureBrandDataDir } from "@/lib/brands";
import {
  type Review,
  type ReviewsData,
  type ReviewSource,
  REVIEWS_FILENAME,
} from "@/lib/reviews";
import type { SlackMessage } from "@/lib/slack";

function getFilePath(brandId: string): string {
  return path.join(getBrandDataDir(brandId), REVIEWS_FILENAME);
}

function defaultData(): ReviewsData {
  return { updatedAt: new Date().toISOString(), reviews: [] };
}

/**
 * Markdown section of sample reviews for LLM prompts (empty string if none).
 * Caps count and length to keep context bounded.
 */
export function formatReviewSnippetsForPrompt(
  brandId: string,
  options?: { limit?: number; maxCharsPerReview?: number }
): string {
  const limit = options?.limit ?? 12;
  const maxChars = options?.maxCharsPerReview ?? 200;
  const { reviews } = readReviews(brandId);
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

export function readReviews(brandId: string): ReviewsData {
  const filePath = getFilePath(brandId);
  if (!fs.existsSync(filePath)) return defaultData();
  const raw = fs.readFileSync(filePath, "utf-8");
  try {
    const data = JSON.parse(raw) as ReviewsData;
    if (!Array.isArray(data?.reviews)) return defaultData();
    return {
      updatedAt: data.updatedAt ?? new Date().toISOString(),
      slackChannelId: data.slackChannelId,
      reviews: data.reviews,
    };
  } catch {
    return defaultData();
  }
}

export function writeReviews(brandId: string, data: ReviewsData): void {
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

/** Merge incoming reviews: by id or slackMessageTs, avoid duplicates; new ones get ids. */
export function mergeReviews(
  brandId: string,
  incoming: Omit<Review, "id">[],
  options?: { slackChannelId?: string }
): { added: number; total: number } {
  const data = readReviews(brandId);
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
  writeReviews(brandId, data);
  return { added, total: data.reviews.length };
}

/** Infer source from text (e.g. "Trustpilot" or "App Store" in message). */
export function inferSource(text: string): ReviewSource {
  const lower = text.toLowerCase();
  if (lower.includes("trustpilot")) return "trustpilot";
  if (lower.includes("app store") || lower.includes("appstore")) return "app_store";
  return "unknown";
}

/** Parse a star rating from footer text like "★★★★★ Verified" */
function parseStars(footer?: string): number | undefined {
  if (!footer) return undefined;
  const stars = (footer.match(/★/g) || []).length;
  return stars > 0 ? stars : undefined;
}

/** Parse Slack message into a Review, handling both plain text and attachment formats. */
export function parseSlackMessage(
  msg: SlackMessage
): Omit<Review, "id"> {
  const att = msg.attachments?.[0];

  // Trustpilot: review data lives in attachments
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

  // App Store Review Bot / other: review data is in message text
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
