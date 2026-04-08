import { NextRequest, NextResponse } from "next/server";
import { getBrand } from "@/lib/brands";
import { updateReviewMetadata } from "@/lib/reviews-storage";

export async function PATCH(
  req: NextRequest,
  ctx: { params: Promise<{ id: string }> }
) {
  const { id: reviewId } = await ctx.params;
  const body = await req.json().catch(() => ({}));
  const brandId =
    (body.brand as string) || req.nextUrl.searchParams.get("brand");

  if (!brandId) {
    return NextResponse.json({ error: "Missing brand" }, { status: 400 });
  }
  if (!getBrand(brandId)) {
    return NextResponse.json({ error: "Unknown brand" }, { status: 400 });
  }

  const patch: { starred?: boolean; topics?: string[] } = {};
  if (typeof body.starred === "boolean") patch.starred = body.starred;
  if (Array.isArray(body.topics)) {
    patch.topics = body.topics.filter((t: unknown) => typeof t === "string");
  }

  if (patch.starred === undefined && patch.topics === undefined) {
    return NextResponse.json(
      { error: "Provide starred and/or topics" },
      { status: 400 }
    );
  }

  const updated = await updateReviewMetadata(brandId, reviewId, patch);
  if (!updated) {
    return NextResponse.json({ error: "Review not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true, review: updated });
}
