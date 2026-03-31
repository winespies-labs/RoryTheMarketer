import { NextRequest, NextResponse } from "next/server";
import { getBrand } from "@/lib/brands";
import { listReferenceAds } from "@/lib/reference-ads";

export const maxDuration = 30;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const brandId = searchParams.get("brand");

  if (!brandId || !getBrand(brandId)) {
    return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
  }

  const typeFilter = searchParams.get("type");

  const all = listReferenceAds();
  let filtered = all.filter(
    (a) => !a.brand || a.brand === brandId,
  );

  if (typeFilter) {
    filtered = filtered.filter((a) => a.type === typeFilter);
  }

  return NextResponse.json({
    referenceAds: filtered.map((a) => ({
      id: a.id,
      label: a.label,
      angle: a.angle,
      nanoBanana: a.nanoBanana,
      imageFile: a.imageFile,
      platform: a.platform,
      format: a.format,
      type: a.type,
      aspectRatio: a.aspectRatio,
      notes: a.notes,
    })),
  });
}

