import { NextRequest, NextResponse } from "next/server";
import { getReferenceAdById } from "@/lib/reference-ads";

export async function GET(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const ad = getReferenceAdById(id);
  if (!ad) {
    return NextResponse.json({ error: "Reference ad not found" }, { status: 404 });
  }

  // Extract prompt guidance from raw markdown
  const guidanceMatch = ad.rawMarkdown.match(
    /^## Prompt Guidance for Variations\s*\n([\s\S]*?)(?=^## |\Z)/m,
  );
  const promptGuidance = guidanceMatch ? guidanceMatch[1].trim() : "";

  return NextResponse.json({
    referenceAd: {
      id: ad.meta.id,
      label: ad.meta.label,
      brand: ad.meta.brand,
      platform: ad.meta.platform,
      format: ad.meta.format,
      type: ad.meta.type,
      aspectRatio: ad.meta.aspectRatio,
      objective: ad.meta.objective,
      angle: ad.meta.angle,
      nanoBanana: ad.meta.nanoBanana,
      imageFile: ad.meta.imageFile,
      notes: ad.meta.notes,
      promptOverrides: ad.meta.promptOverrides,
      // Content sections
      primaryText: ad.primaryText,
      headline: ad.headline,
      description: ad.description,
      visualNotes: ad.visualNotes,
      promptGuidance,
      adDescription: ad.adDescription,
    },
  });
}
