import { NextRequest, NextResponse } from "next/server";
import path from "path";
import { getBrand } from "@/lib/brands";
import { addBrandAsset } from "@/lib/brand-assets-storage";
import type { AssetCategory } from "@/lib/brand-assets";
import { ASSET_CATEGORIES } from "@/lib/brand-assets";

const ALLOWED_EXT = [".png", ".jpg", ".jpeg", ".webp", ".gif"];
const CATEGORY_VALUES = new Set<string>(ASSET_CATEGORIES.map((c) => c.value));

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get("image") as File | null;
    const brandId = (formData.get("brand") as string) || null;
    const label = (formData.get("label") as string) || "";
    const category = ((formData.get("category") as string) || "other") as AssetCategory;

    if (!brandId || !getBrand(brandId)) {
      return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
    }
    if (!imageFile || typeof imageFile.arrayBuffer !== "function") {
      return NextResponse.json({ error: "Image file is required" }, { status: 400 });
    }
    if (!CATEGORY_VALUES.has(category)) {
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
    const asset = await addBrandAsset(brandId, {
      label: label.trim() || imageFile.name.replace(/\.[^.]+$/, ""),
      category,
      originalName: imageFile.name,
      file: { buffer, originalFilename: imageFile.name },
    });

    return NextResponse.json({ asset });
  } catch (err) {
    console.error("Brand asset upload error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to upload asset" },
      { status: 500 }
    );
  }
}
