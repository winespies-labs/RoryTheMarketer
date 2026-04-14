import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getBrand } from "@/lib/brands";
import type { UspCategory } from "@/lib/reviews";
import {
  loadUnscoredReviews,
  updateReviewScoring,
  getUnscoredCount,
} from "@/lib/reviews-storage";

export const maxDuration = 60;

const client = new Anthropic();

interface ScoreResult {
  id: string;
  uspCategory: UspCategory | null;
  adScore: number;
  extractedQuote: string;
}

async function scoreBatch(
  reviews: { id: string; content: string; title?: string; rating?: number }[]
): Promise<ScoreResult[]> {
  const reviewList = reviews
    .map(
      (r, i) =>
        `[${i}] ID: ${r.id}\nRating: ${r.rating ?? "unknown"}/5\n${r.title ? `Title: ${r.title}\n` : ""}Review: ${r.content.slice(0, 600)}`
    )
    .join("\n\n---\n\n");

  const msg = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: `You are scoring customer reviews for Wine Spies, a wine e-commerce brand with three USPs:

1. "best-price" — We taste every wine, verify it's the lowest price on Wine-Searcher, and only sell if it meets both quality and price standards.
2. "locker" — Customers build up 1-2 bottles per order in their Locker; at 12 bottles it ships free on their schedule.
3. "satisfaction-guaranteed" — Real customer service, standing behind every purchase.

For each review below, return a JSON array with one object per review:
- "id": the review ID (copy exactly)
- "uspCategory": which USP this review best supports — "best-price", "locker", or "satisfaction-guaranteed" — or null if none clearly applies
- "adScore": 0–100 integer. Score higher for: specificity (mentions Locker, price, bottles, specific wine), quotability (excerpt stands alone), emotional resonance, brevity. 5-star reviews score higher than lower-rated ones.
- "extractedQuote": the single best 1–2 sentence excerpt from the review body, suitable to use verbatim in a Facebook ad. Must be self-contained. Max 200 characters.

Return ONLY a valid JSON array. No markdown, no explanation.

Reviews:

${reviewList}`,
      },
    ],
  });

  const textBlock = msg.content.find((b) => b.type === "text");
  if (!textBlock || textBlock.type !== "text") {
    throw new Error("Claude returned non-text response");
  }
  let parsed: ScoreResult[];
  try {
    parsed = JSON.parse(textBlock.text.trim()) as ScoreResult[];
  } catch (e) {
    throw new Error(`Failed to parse Claude response: ${String(e)}`);
  }
  return parsed;
}

export async function POST(req: NextRequest) {
  const brandId = req.nextUrl.searchParams.get("brand") ?? "winespies";
  if (!getBrand(brandId)) {
    return NextResponse.json({ error: "Unknown brand" }, { status: 400 });
  }

  const unscored = await loadUnscoredReviews(brandId);
  if (unscored.length === 0) {
    return NextResponse.json({ scored: 0, remaining: 0 });
  }

  const BATCH_SIZE = 20;
  let scored = 0;
  let errors = 0;

  for (let i = 0; i < unscored.length; i += BATCH_SIZE) {
    const batch = unscored.slice(i, i + BATCH_SIZE);
    try {
      const results = await scoreBatch(
        batch.map((r) => ({
          id: r.id,
          content: r.content,
          title: r.title,
          rating: r.rating,
        }))
      );
      await Promise.all(
        results.map((result) =>
          updateReviewScoring(brandId, result.id, {
            uspCategory: result.uspCategory,
            adScore: Math.max(0, Math.min(100, result.adScore)),
            extractedQuote: result.extractedQuote ?? "",
          })
        )
      );
      scored += results.length;
    } catch {
      errors += batch.length;
    }
  }

  const remaining = await getUnscoredCount(brandId);
  return NextResponse.json({ scored, errors, remaining });
}
