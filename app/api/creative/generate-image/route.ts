import { NextRequest, NextResponse } from "next/server";
import { generateWithFal } from "@/lib/fal";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      prompt: string;
      bottleImageUrl?: string;
    };

    const { prompt, bottleImageUrl } = body;
    if (!prompt) {
      return NextResponse.json({ error: "prompt is required" }, { status: 400 });
    }

    const result = await generateWithFal({
      prompt,
      imageUrls: bottleImageUrl ? [bottleImageUrl] : undefined,
      numImages: 1,
      imageSize: { width: 1024, height: 1024 },
    });

    const img = result.images[0];
    if (!img) {
      return NextResponse.json({ error: "No image returned" }, { status: 500 });
    }

    const imageDataUrl = `data:${img.mimeType};base64,${img.base64}`;
    return NextResponse.json({ imageDataUrl });
  } catch (err) {
    console.error("[generate-image]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Image generation failed" },
      { status: 500 }
    );
  }
}
