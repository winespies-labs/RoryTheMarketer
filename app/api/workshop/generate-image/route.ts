import { NextRequest, NextResponse } from "next/server";
import { generateWithFal } from "@/lib/fal";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  if (!process.env.FAL_KEY?.trim()) {
    return NextResponse.json(
      { error: "FAL_KEY is not configured. Add it to your environment variables." },
      { status: 503 },
    );
  }

  let body: { prompt?: string; numImages?: number; imageSize?: { width: number; height: number } };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const { prompt, numImages, imageSize } = body;
  if (!prompt?.trim()) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  try {
    const result = await generateWithFal({
      prompt,
      numImages: numImages ?? 1,
      imageSize: imageSize ?? { width: 1080, height: 1080 },
    });

    return NextResponse.json({ images: result.images });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Image generation failed" },
      { status: 500 },
    );
  }
}
