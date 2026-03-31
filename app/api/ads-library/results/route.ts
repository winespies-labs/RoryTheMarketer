import { NextRequest, NextResponse } from "next/server";
import { getBrand } from "@/lib/brands";
import { readAdsLibraryResults } from "@/lib/competitor-ads-storage";

export async function GET(req: NextRequest) {
  const brandId = req.nextUrl.searchParams.get("brand");
  if (!brandId || !getBrand(brandId)) {
    return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
  }
  const data = readAdsLibraryResults(brandId);
  return NextResponse.json(data);
}
