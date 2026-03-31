import { NextRequest, NextResponse } from "next/server";
import { getBrand } from "@/lib/brands";
import { getContextBundle } from "@/lib/context-bundle";

export async function GET(req: NextRequest) {
  const brandId = req.nextUrl.searchParams.get("brand");
  if (!brandId) {
    return NextResponse.json({ error: "Missing brand" }, { status: 400 });
  }
  if (!getBrand(brandId)) {
    return NextResponse.json({ error: "Unknown brand" }, { status: 400 });
  }

  const bundle = getContextBundle(brandId);
  return NextResponse.json(bundle);
}
