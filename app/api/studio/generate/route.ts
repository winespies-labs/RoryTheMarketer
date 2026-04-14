// app/api/studio/generate/route.ts
import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import { getReferenceAdById, getReferenceAdStyleImagePath } from "@/lib/reference-ads";
import { generateAdImage } from "@/lib/gemini";

export const maxDuration = 120;

function resolveTokens(template: string, tokens: Record<string, string>): string {
  return template.replace(/\{\{(\w+)\}\}/g, (_, key: string) => tokens[key] ?? "");
}

interface GenerateRequest {
  styleId: string;
  tokens: Record<string, string>;
}

export async function POST(req: NextRequest) {
  let body: GenerateRequest;
  try {
    body = await req.json() as GenerateRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { styleId, tokens } = body;

  const ad = getReferenceAdById(styleId);
  if (!ad) {
    return NextResponse.json({ error: "Style not found" }, { status: 404 });
  }
  if (!ad.generationPrompt) {
    return NextResponse.json({ error: "This style has no generation prompt. Edit the prompt in the Style picker first." }, { status: 400 });
  }

  const customPrompt = resolveTokens(ad.generationPrompt, tokens);

  const imagePath = getReferenceAdStyleImagePath(styleId);
  if (!imagePath) {
    return NextResponse.json({ error: "Style image not found on disk" }, { status: 404 });
  }

  const imageBuffer = fs.readFileSync(imagePath);
  const referenceImageBase64 = imageBuffer.toString("base64");
  const ext = imagePath.split(".").pop()?.toLowerCase() ?? "png";
  const mimeMap: Record<string, string> = {
    webp: "image/webp",
    png: "image/png",
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
  };
  const referenceImageMimeType = mimeMap[ext] ?? "image/png";

  const numberOfVariations = Math.max(
    1,
    (ad.meta.promptOverrides?.numberOfVariations as number | undefined) ?? 1
  );

  try {
    const jobs = Array.from({ length: numberOfVariations }, () =>
      generateAdImage({
        referenceImageBase64,
        referenceImageMimeType,
        wineDetails: { headline: tokens.headline ?? "" },
        styleName: ad.meta.label,
        customPrompt,
      })
    );

    const results = await Promise.all(jobs);
    const images = results.map((r) => ({ base64: r.imageBase64, mimeType: r.mimeType }));
    return NextResponse.json({ images });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Image generation failed" },
      { status: 500 }
    );
  }
}
