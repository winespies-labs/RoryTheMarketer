import { NextRequest, NextResponse } from "next/server";
import path from "path";
import fs from "fs";
import { getBrand } from "@/lib/brands";
import { nanoid } from "nanoid";
import { addSwipeInspirationItem, getAssetsDir } from "@/lib/swipe-inspiration-storage";
import { ensureBrandDataDir } from "@/lib/brands";
import { useDatabase } from "@/lib/database";
import type { SwipeStyle, SwipeCategory } from "@/lib/swipe-inspiration";
import { STYLES, CATEGORIES } from "@/lib/swipe-inspiration";

const STYLE_VALUES = new Set<string>(STYLES.map((s) => s.value));
const CATEGORY_VALUES = new Set<string>(CATEGORIES.map((c) => c.value));

const ALLOWED_EXT = [".png", ".jpg", ".jpeg", ".webp", ".gif"];

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get("image") as File | null;
    const brandId = (formData.get("brand") as string) || null;
    const title = (formData.get("title") as string) || undefined;
    const content = (formData.get("content") as string) || ""; // caption/notes
    const style = (formData.get("style") as string) || undefined;
    const category = (formData.get("category") as string) || undefined;
    const tagsStr = (formData.get("tags") as string) || "";
    const useInContext = formData.get("useInContext") === "true";

    if (!brandId || !getBrand(brandId)) {
      return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
    }
    if (!imageFile || typeof imageFile.arrayBuffer !== "function") {
      return NextResponse.json(
        { error: "Image file is required" },
        { status: 400 }
      );
    }

    if (style && !STYLE_VALUES.has(style)) {
      return NextResponse.json({ error: "Invalid style" }, { status: 400 });
    }
    if (category && !CATEGORY_VALUES.has(category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }

    const ext = path.extname(imageFile.name).toLowerCase();
    if (!ALLOWED_EXT.includes(ext)) {
      return NextResponse.json(
        { error: "Allowed formats: PNG, JPG, JPEG, WEBP, GIF" },
        { status: 400 }
      );
    }

    const buffer = Buffer.from(await imageFile.arrayBuffer());
    const id = nanoid();
    const safeExt = ext.startsWith(".") ? ext : `.${ext}`;
    const mime = MIME_BY_EXT[safeExt.toLowerCase()] || imageFile.type || "image/png";

    if (useDatabase()) {
      const item = await addSwipeInspirationItem(brandId, {
        id,
        type: "image",
        content: content.trim(),
        title: title?.trim() || undefined,
        style: style as SwipeStyle | undefined,
        category: category as SwipeCategory | undefined,
        tags: tagsStr
          .split(/[\s,]+/)
          .map((t) => t.trim())
          .filter(Boolean),
        imagePayload: { buffer, mime },
        useInContext,
      });
      return NextResponse.json({ item });
    }

    const imageFilename = `${id}${safeExt}`;
    const assetsDir = getAssetsDir(brandId);
    ensureBrandDataDir(brandId);
    if (!fs.existsSync(assetsDir)) {
      fs.mkdirSync(assetsDir, { recursive: true });
    }
    fs.writeFileSync(path.join(assetsDir, imageFilename), buffer);

    const item = await addSwipeInspirationItem(brandId, {
      id,
      type: "image",
      content: content.trim(),
      title: title?.trim() || undefined,
      style: style as SwipeStyle | undefined,
      category: category as SwipeCategory | undefined,
      tags: tagsStr
        .split(/[\s,]+/)
        .map((t) => t.trim())
        .filter(Boolean),
      imageFile: imageFilename,
      useInContext,
    });

    return NextResponse.json({ item });
  } catch (err) {
    console.error("Swipe inspiration upload error:", err);
    return NextResponse.json(
      {
        error:
          err instanceof Error ? err.message : "Failed to upload screenshot",
      },
      { status: 500 }
    );
  }
}
