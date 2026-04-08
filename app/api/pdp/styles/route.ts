import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { readStyles, getAdBuilderDir } from "@/lib/ad-builder-storage";
import { STYLES_SUBDIR } from "@/lib/ad-builder";

export async function GET(req: NextRequest) {
  const brand = req.nextUrl.searchParams.get("brand") ?? "winespies";
  const { styles } = readStyles(brand);

  const withImages = styles.map((style) => {
    const imgPath = path.join(getAdBuilderDir(brand), STYLES_SUBDIR, style.filename);
    let imageBase64 = "";
    let mimeType = "image/png";
    try {
      imageBase64 = fs.readFileSync(imgPath).toString("base64");
      const ext = path.extname(style.filename).toLowerCase();
      if (ext === ".jpg" || ext === ".jpeg") mimeType = "image/jpeg";
      else if (ext === ".webp") mimeType = "image/webp";
    } catch {
      // Style image missing — return empty, card will show placeholder
    }
    return { id: style.id, name: style.name, addedAt: style.addedAt, imageBase64, mimeType };
  });

  return NextResponse.json(withImages);
}
