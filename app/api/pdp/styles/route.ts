import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { listReferenceAds, getReferenceAdStyleImagePath } from "@/lib/reference-ads";

export async function GET(_req: NextRequest) {
  const ads = listReferenceAds();

  const withImages = ads.map((ad) => {
    let imageBase64 = "";
    let mimeType = "image/png";
    const imagePath = getReferenceAdStyleImagePath(ad.id);
    if (imagePath) {
      try {
        imageBase64 = fs.readFileSync(imagePath).toString("base64");
        const ext = path.extname(imagePath).toLowerCase();
        if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
        else if (ext === ".webp") mimeType = "image/webp";
      } catch {
        // image unreadable — return empty, card will show placeholder
      }
    }
    return { id: ad.id, name: ad.label, imageBase64, mimeType };
  });

  return NextResponse.json(withImages);
}
