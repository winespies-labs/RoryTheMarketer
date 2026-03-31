import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getBrand } from "@/lib/brands";
import { readReviews } from "@/lib/reviews-storage";
import { readReviewThemes, writeReviewThemes } from "@/lib/review-themes-storage";

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const brandId = (body.brand as string) || req.nextUrl.searchParams.get("brand");

  if (!brandId || !getBrand(brandId)) {
    return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
  }

  const { reviews } = readReviews(brandId);
  if (!reviews.length) {
    return NextResponse.json({ error: "No reviews to summarize" }, { status: 400 });
  }

  // Build review text for Claude (truncate if very large)
  const reviewLines = reviews.slice(0, 500).map((r, i) => {
    const stars = r.rating ? `${"★".repeat(r.rating)}${"☆".repeat(5 - r.rating)}` : "";
    const source = r.source !== "unknown" ? `[${r.source}]` : "";
    return `${i + 1}. ${source} ${stars}\n${r.title ? r.title + ": " : ""}${r.content}`;
  });

  const response = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 2048,
    messages: [
      {
        role: "user",
        content: `You are analyzing ${reviews.length} customer reviews for a brand. Summarize the key themes in a concise format that a marketing strategist can use for copywriting and campaign planning.

Include:
- Top positive themes and proof points (what customers love most)
- Common objections or complaints
- Recurring language/phrases customers use (valuable for ad copy)
- Notable patterns by source (Trustpilot vs App Store) if different

Keep it to 3-5 short paragraphs. Be specific — quote recurring phrases where possible.

Reviews:
${reviewLines.join("\n\n")}`,
      },
    ],
  });

  const summary =
    response.content[0].type === "text" ? response.content[0].text : "";

  writeReviewThemes(brandId, { generatedAt: new Date().toISOString(), summary });

  return NextResponse.json({ ok: true, summary });
}

export async function GET(req: NextRequest) {
  const brandId = req.nextUrl.searchParams.get("brand");
  if (!brandId || !getBrand(brandId)) {
    return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
  }
  const themes = readReviewThemes(brandId);
  return NextResponse.json(themes ?? { summary: null });
}
