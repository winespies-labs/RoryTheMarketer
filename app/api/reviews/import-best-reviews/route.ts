import { NextRequest, NextResponse } from "next/server";
import { getBrand } from "@/lib/brands";
import { parseBestReviewsMd } from "@/lib/parse-best-reviews-md";
import { importBestReviews } from "@/lib/reviews-storage";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { brand?: string; markdown?: string };
    const brandId = body.brand ?? "winespies";

    if (!getBrand(brandId)) {
      return NextResponse.json({ error: "Unknown brand" }, { status: 400 });
    }
    if (!body.markdown || typeof body.markdown !== "string") {
      return NextResponse.json({ error: "Missing markdown" }, { status: 400 });
    }

    const parsed = parseBestReviewsMd(body.markdown);
    if (parsed.length === 0) {
      return NextResponse.json({ error: "No reviews parsed from markdown" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const rows = parsed.map((r) => ({
      content: r.content,
      author: r.author || undefined,
      createdAt: r.createdAt,
      uspCategory: r.uspCategory,
      adScore: 80,
      extractedQuote: r.extractedQuote,
      scoredAt: now,
    }));

    const result = await importBestReviews(brandId, rows);
    return NextResponse.json({ ok: true, parsed: parsed.length, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
