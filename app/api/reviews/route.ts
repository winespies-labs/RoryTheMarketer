import { NextRequest, NextResponse } from "next/server";
import { getBrand } from "@/lib/brands";
import type { ReviewSnippet } from "@/lib/reviews";
import { listReviewsForApi } from "@/lib/reviews-storage";

function parseBool(v: string | null): boolean {
  return v === "1" || v === "true" || v === "yes";
}

export async function GET(req: NextRequest) {
  const brandId = req.nextUrl.searchParams.get("brand");
  if (!brandId) {
    return NextResponse.json({ error: "Missing brand" }, { status: 400 });
  }
  if (!getBrand(brandId)) {
    return NextResponse.json({ error: "Unknown brand" }, { status: 400 });
  }

  const q = req.nextUrl.searchParams.get("q") ?? undefined;
  const topic = req.nextUrl.searchParams.get("topic") ?? undefined;
  const starredOnly = parseBool(req.nextUrl.searchParams.get("starred"));
  const limit = Math.min(
    Math.max(Number.parseInt(req.nextUrl.searchParams.get("limit") ?? "60", 10) || 60, 1),
    200
  );
  const offset = Math.max(
    Number.parseInt(req.nextUrl.searchParams.get("offset") ?? "0", 10) || 0,
    0
  );

  const {
    page,
    storeTotal,
    matchCount,
    topicsInUse,
    updatedAt,
    slackChannelId,
  } = await listReviewsForApi(brandId, {
    q,
    topic,
    starredOnly,
    limit,
    offset,
  });

  const snippets: ReviewSnippet[] = page.map((r) => ({
    id: r.id,
    title: r.title,
    content: r.content,
    source: r.source,
    starred: r.starred,
    topics: r.topics,
  }));

  return NextResponse.json({
    reviews: snippets,
    storeTotal,
    matchCount,
    offset,
    limit,
    hasMore: offset + page.length < matchCount,
    updatedAt,
    slackChannelId,
    topicsInUse,
  });
}
