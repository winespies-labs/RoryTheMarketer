import { NextRequest, NextResponse } from "next/server";
import { getBrand } from "@/lib/brands";
import { searchInstagram } from "@/lib/apify";
import { nanoid } from "nanoid";
import type { InstagramPost } from "@/lib/instagram-research";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const brandId = body.brand as string | undefined;
    const keyword = body.keyword as string | undefined;
    const limit = body.limit as number | undefined;

    if (!brandId || !getBrand(brandId)) {
      return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
    }
    if (!keyword?.trim()) {
      return NextResponse.json({ error: "Keyword is required" }, { status: 400 });
    }

    const results = await searchInstagram(keyword.trim(), {
      resultsLimit: limit ?? 30,
    });

    const posts: InstagramPost[] = results.map((r) => ({
      id: nanoid(),
      shortCode: r.shortCode,
      url: r.url,
      type: r.type as "Image" | "Video" | "Sidecar",
      caption: r.caption,
      ownerUsername: r.ownerUsername,
      ownerFullName: r.ownerFullName,
      likesCount: r.likesCount,
      commentsCount: r.commentsCount,
      videoViewCount: r.videoViewCount,
      videoUrl: r.videoUrl,
      displayUrl: r.displayUrl,
      timestamp: r.timestamp,
      hashtags: r.hashtags,
      mentions: r.mentions,
    }));

    return NextResponse.json({
      keyword: keyword.trim(),
      searchedAt: new Date().toISOString(),
      resultCount: posts.length,
      posts,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Search failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
