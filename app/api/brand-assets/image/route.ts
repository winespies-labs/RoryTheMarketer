import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { getBrand } from "@/lib/brands";
import { getBrandAssetById, getAssetsDir } from "@/lib/brand-assets-storage";

export async function GET(req: NextRequest) {
  const brandId = req.nextUrl.searchParams.get("brand");
  const id = req.nextUrl.searchParams.get("id");

  if (!brandId || !id || !getBrand(brandId)) {
    return NextResponse.json({ error: "brand and id required" }, { status: 400 });
  }

  const asset = getBrandAssetById(brandId, id);
  if (!asset) {
    return new NextResponse("Not found", { status: 404 });
  }

  const imagePath = path.join(getAssetsDir(brandId), asset.filename);
  if (!fs.existsSync(imagePath)) {
    return new NextResponse("Not found", { status: 404 });
  }

  const ext = path.extname(imagePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
  };
  const contentType = mimeMap[ext] || "image/png";
  const buffer = fs.readFileSync(imagePath);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
