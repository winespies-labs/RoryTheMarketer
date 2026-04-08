import { NextRequest, NextResponse } from "next/server";
import { getBrand } from "@/lib/brands";
import { readBrandAssets, deleteBrandAsset } from "@/lib/brand-assets-storage";
import { useDatabase } from "@/lib/database";
import type { AssetCategory } from "@/lib/brand-assets";

export async function GET(req: NextRequest) {
  const brandId = req.nextUrl.searchParams.get("brand");
  const category = req.nextUrl.searchParams.get("category") as AssetCategory | null;

  if (!brandId || !getBrand(brandId)) {
    return NextResponse.json({ error: "brand required" }, { status: 400 });
  }

  const data = await readBrandAssets(brandId);
  let assets = data.assets;
  if (category) {
    assets = assets.filter((a) => a.category === category);
  }

  return NextResponse.json({ assets, storageMode: useDatabase() ? "database" : "filesystem" });
}

export async function DELETE(req: NextRequest) {
  const brandId = req.nextUrl.searchParams.get("brand");
  const id = req.nextUrl.searchParams.get("id");

  if (!brandId || !id || !getBrand(brandId)) {
    return NextResponse.json({ error: "brand and id required" }, { status: 400 });
  }

  const ok = await deleteBrandAsset(brandId, id);
  if (!ok) {
    return NextResponse.json({ error: "Asset not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
