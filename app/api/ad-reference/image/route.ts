import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getReferenceAdStyleImagePath } from "@/lib/reference-ads";

export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const imagePath = getReferenceAdStyleImagePath(id);
  if (!imagePath) {
    return new NextResponse("Not found", { status: 404 });
  }

  const ext = path.extname(imagePath).toLowerCase();
  const mimeMap: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
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
