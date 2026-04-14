import { NextRequest, NextResponse } from "next/server";
import { getBrand } from "@/lib/brands";
import type { UspCategory } from "@/lib/reviews";
import { listReviewsForApi, getUnscoredCount } from "@/lib/reviews-storage";

function parseBool(v: string | null): boolean {
  return v === "1" || v === "true" || v === "yes";
}

export async function GET(req: NextRequest) {
  const brandId = req.nextUrl.searchParams.get("brand") ?? "winespies";
  if (!getBrand(brandId)) {
    return NextResponse.json({ error: "Unknown brand" }, { status: 400 });
  }

  const uspCategory =
    (req.nextUrl.searchParams.get("uspCategory") as UspCategory | null) ??
    undefined;
  const starredOnly = parseBool(req.nextUrl.searchParams.get("starred"));
  const sort = req.nextUrl.searchParams.get("sort") ?? "score";
  const unscoredOnly = parseBool(req.nextUrl.searchParams.get("unscored"));
  const limit = Math.min(
    Math.max(
      Number.parseInt(req.nextUrl.searchParams.get("limit") ?? "60", 10) || 60,
      1
    ),
    200
  );
  const offset = Math.max(
    Number.parseInt(req.nextUrl.searchParams.get("offset") ?? "0", 10) || 0,
    0
  );

  // Re-use the existing listReviewsForApi with topic filter mapped to uspCategory
  // For unscored tab we pass a sentinel — the storage layer doesn't filter by scoredAt yet,
  // so we fetch all and filter in the route for now.
  const { page: allPage, storeTotal } = await listReviewsForApi(brandId, {
    starredOnly,
    limit: 1000, // fetch all then filter — testimonials dataset is small
    offset: 0,
  });

  // Apply testimonials-specific filters
  let filtered = allPage;

  if (unscoredOnly) {
    filtered = filtered.filter((r) => !r.scoredAt);
  } else if (uspCategory) {
    filtered = filtered.filter((r) => r.uspCategory === uspCategory);
  } else {
    // "All" tab — show scored reviews only in the main view
    filtered = filtered.filter((r) => r.scoredAt != null);
  }

  // Sort
  if (sort === "score") {
    filtered = filtered.sort((a, b) => (b.adScore ?? 0) - (a.adScore ?? 0));
  } else if (sort === "rating") {
    filtered = filtered.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  } else {
    // date
    filtered = filtered.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  const matchCount = filtered.length;
  const page = filtered.slice(offset, offset + limit);

  const unscoredCount = await getUnscoredCount(brandId);

  return NextResponse.json({
    testimonials: page,
    storeTotal,
    matchCount,
    unscoredCount,
    offset,
    limit,
    hasMore: offset + page.length < matchCount,
  });
}
