import { NextRequest, NextResponse } from "next/server";
import { getBrand } from "@/lib/brands";
import { createReferenceAd } from "@/lib/reference-ads";
import type { ReferenceAdCreateInput } from "@/lib/reference-ads";
import path from "path";

export const maxDuration = 30;

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get("image") as File | null;
    const dataStr = formData.get("data") as string | null;

    if (!imageFile) {
      return NextResponse.json({ error: "Image file is required" }, { status: 400 });
    }
    if (!dataStr) {
      return NextResponse.json({ error: "Data JSON is required" }, { status: 400 });
    }

    let input: ReferenceAdCreateInput;
    try {
      input = JSON.parse(dataStr);
    } catch {
      return NextResponse.json({ error: "Invalid JSON in data field" }, { status: 400 });
    }

    if (!input.label || !input.brand) {
      return NextResponse.json({ error: "label and brand are required" }, { status: 400 });
    }

    if (!getBrand(input.brand)) {
      return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
    }

    const buffer = Buffer.from(await imageFile.arrayBuffer());
    const ext = path.extname(imageFile.name) || ".png";

    const referenceAd = createReferenceAd(input, buffer, ext);

    return NextResponse.json({ referenceAd });
  } catch (err) {
    console.error("Error creating reference ad:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to create reference ad" },
      { status: 500 },
    );
  }
}
