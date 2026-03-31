import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getBrand, getBrandContextDir } from "@/lib/brands";
import { ALL_SECTIONS } from "@/lib/context-sections";
import { readMetaComments } from "@/lib/meta-comments-storage";
import { readReviews } from "@/lib/reviews-storage";

export async function GET(req: NextRequest) {
  const brand = req.nextUrl.searchParams.get("brand");
  if (!brand) {
    return NextResponse.json({ error: "brand required" }, { status: 400 });
  }
  if (!getBrand(brand)) {
    return NextResponse.json({ error: "unknown brand" }, { status: 404 });
  }

  const contextDir = getBrandContextDir(brand);
  const status: Record<string, boolean> = {};

  for (const section of ALL_SECTIONS) {
    switch (section.type) {
      case "markdown": {
        if (!section.file) {
          status[section.id] = false;
          break;
        }
        const filePath = path.join(contextDir, section.file);
        try {
          const content = fs.readFileSync(filePath, "utf-8").trim();
          status[section.id] = content.length > 0;
        } catch {
          status[section.id] = false;
        }
        break;
      }
      case "meta-comments": {
        const comments = readMetaComments(brand);
        status[section.id] = comments !== null && comments.comments.length > 0;
        break;
      }
      case "reviews": {
        const reviews = readReviews(brand);
        status[section.id] = reviews.reviews.length > 0;
        break;
      }
    }
  }

  return NextResponse.json({ status });
}
