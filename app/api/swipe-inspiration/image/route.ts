import { NextRequest, NextResponse } from "next/server";
import { getBrand } from "@/lib/brands";
import {
  getSwipeInspirationItemById,
  getSwipeInspirationImageBytes,
} from "@/lib/swipe-inspiration-storage";

export async function GET(req: NextRequest) {
  const brandId = req.nextUrl.searchParams.get("brand");
  const id = req.nextUrl.searchParams.get("id");
  if (!brandId || !id || !getBrand(brandId)) {
    return NextResponse.json({ error: "brand and id required" }, { status: 400 });
  }

  const item = await getSwipeInspirationItemById(brandId, id);
  if (!item) {
    return new NextResponse("Not found", { status: 404 });
  }

  const payload = await getSwipeInspirationImageBytes(brandId, item);
  if (!payload) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(new Uint8Array(payload.buffer), {
    headers: {
      "Content-Type": payload.mime,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
