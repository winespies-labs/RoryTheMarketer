import { NextRequest, NextResponse } from "next/server";
import { getBrand } from "@/lib/brands";
import { readReviews } from "@/lib/reviews-storage";
import type { ReviewSnippet } from "@/lib/reviews";

export async function GET(req: NextRequest) {
  const brandId = req.nextUrl.searchParams.get("brand");
  if (!brandId) {
    return NextResponse.json({ error: "Missing brand" }, { status: 400 });
  }
  if (!getBrand(brandId)) {
    return NextResponse.json({ error: "Unknown brand" }, { status: 400 });
  }

  const data = readReviews(brandId);
  const q = req.nextUrl.searchParams.get("q")?.toLowerCase().trim();
  let reviews = data.reviews;
  if (q) {
    reviews = reviews.filter(
      (r) =>
        (r.title?.toLowerCase().includes(q)) ||
        r.content.toLowerCase().includes(q)
    );
  }

  const snippets: ReviewSnippet[] = reviews.map((r) => ({
    id: r.id,
    title: r.title,
    content: r.content,
    source: r.source,
  }));

  return NextResponse.json({
    reviews: snippets,
    total: data.reviews.length,
    updatedAt: data.updatedAt,
    slackChannelId: data.slackChannelId,
  });
}
