import { NextRequest, NextResponse } from "next/server";
import { getBrand } from "@/lib/brands";
import { getBrandAssetById, getBrandAssetImageBytes } from "@/lib/brand-assets-storage";

export async function GET(req: NextRequest) {
  const brandId = req.nextUrl.searchParams.get("brand");
  const id = req.nextUrl.searchParams.get("id");

  if (!brandId || !id || !getBrand(brandId)) {
    return NextResponse.json({ error: "brand and id required" }, { status: 400 });
  }

  const asset = await getBrandAssetById(brandId, id);
  if (!asset) {
    return new NextResponse("Not found", { status: 404 });
  }

  const resolved = await getBrandAssetImageBytes(brandId, asset);
  if (!resolved) {
    return new NextResponse("Not found", { status: 404 });
  }

  return new NextResponse(new Uint8Array(resolved.buffer), {
    headers: {
      "Content-Type": resolved.mime,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
