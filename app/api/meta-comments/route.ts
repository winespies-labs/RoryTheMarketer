import { NextRequest, NextResponse } from "next/server";
import { getBrand } from "@/lib/brands";
import { readMetaComments } from "@/lib/meta-comments-storage";

export async function GET(req: NextRequest) {
  const brandId = req.nextUrl.searchParams.get("brand");
  if (!brandId || !getBrand(brandId)) {
    return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
  }

  const data = readMetaComments(brandId);
  return NextResponse.json({
    syncedAt: data?.syncedAt ?? null,
    postCount: data ? new Set(data.comments.map((c) => c.postId)).size : 0,
    commentCount: data?.comments.length ?? 0,
  });
}

