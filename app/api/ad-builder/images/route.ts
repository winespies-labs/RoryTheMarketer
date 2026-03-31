import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getBrand } from "@/lib/brands";
import { getAdBuilderDir } from "@/lib/ad-builder-storage";

const MIME_TYPES: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export async function GET(req: NextRequest) {
  const brandId = req.nextUrl.searchParams.get("brand");
  const filePath = req.nextUrl.searchParams.get("path");

  if (!brandId || !filePath || !getBrand(brandId)) {
    return NextResponse.json(
      { error: "Missing brand or path" },
      { status: 400 }
    );
  }

  // Path traversal protection
  if (filePath.includes("..") || path.isAbsolute(filePath)) {
    return NextResponse.json({ error: "Invalid path" }, { status: 400 });
  }

  const fullPath = path.join(getAdBuilderDir(brandId), filePath);

  if (!fs.existsSync(fullPath)) {
    return NextResponse.json({ error: "File not found" }, { status: 404 });
  }

  const ext = path.extname(fullPath).toLowerCase();
  const contentType = MIME_TYPES[ext] || "application/octet-stream";
  const buffer = fs.readFileSync(fullPath);

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": contentType,
      "Cache-Control": "public, max-age=3600",
    },
  });
}
