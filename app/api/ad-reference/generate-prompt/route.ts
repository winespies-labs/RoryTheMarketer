// app/api/ad-reference/generate-prompt/route.ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
export const maxDuration = 60;

const VISION_PROMPT = `You are analyzing a reference ad image to write a Gemini image-generation prompt.

Study the ad layout carefully: background treatment (color, lighting, atmospheric effects), product/bottle placement (position, size, angle), all text element positions, typography style, color palette, price block design, CTA button style, logo placement, trust badges.

Write a Gemini image-generation prompt that instructs Gemini to recreate this exact ad style with new wine data. The prompt must:

1. Describe the background precisely (hex colors, lighting direction, atmospheric effects, mood)
2. Describe bottle/product placement in terms of POSITION and LAYOUT ONLY — where it sits on the canvas, relative size, angle, how the background frames it. DO NOT describe the bottle's appearance (color, label design, capsule color, winery name on label, or any markings). The actual bottle will always be different, so only describe placement.
3. List every text element with: position on canvas, font style (serif/sans-serif/monospace), approximate size in px, color in hex, max lines, alignment
4. Use these exact token placeholders for dynamic content:
   - {{wineName}} — wine display name
   - {{score}} — critic score e.g. "98 points" — if this element exists, add the note: "If score is blank, omit this element entirely"
   - {{salePrice}} — the sale price
   - {{retailPrice}} — the original retail price
   - {{pullQuote}} — short body copy / quote, 3 lines max
   - {{ctaText}} — CTA button text
5. For price pills/blocks and CTA button: specify exact dimensions (px), border-radius (px), background colors (hex), text colors (hex), font size, font weight
6. End with a REQUIREMENTS section listing: output size (1080×1080px), "Render all text VERBATIM as provided — do not rephrase, shorten, or invent copy", "Include ONLY the text elements listed above — no extra copy, taglines, or invented phrases", "If any token resolves to blank, omit that element and close the gap", "Professional quality suitable for Meta social media advertising"

Return ONLY the prompt text. No preamble, no explanation, no markdown code fences.`;

const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
type AllowedMimeType = typeof ALLOWED_MIME_TYPES[number];

const MAX_BYTES = 5 * 1024 * 1024; // 5 MB

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get("image") as File | null;

    if (!imageFile) {
      return NextResponse.json({ error: "image is required" }, { status: 400 });
    }

    if (imageFile.size > MAX_BYTES) {
      return NextResponse.json({ error: "Image must be under 5 MB" }, { status: 400 });
    }

    const buffer = Buffer.from(await imageFile.arrayBuffer());
    const base64 = buffer.toString("base64");

    const rawMime = imageFile.type || "image/png";
    const mimeType: AllowedMimeType = (ALLOWED_MIME_TYPES as readonly string[]).includes(rawMime)
      ? (rawMime as AllowedMimeType)
      : "image/png";

    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mimeType, data: base64 },
            },
            { type: "text", text: VISION_PROMPT },
          ],
        },
      ],
    });

    const prompt = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    return NextResponse.json({ prompt });
  } catch (err) {
    console.error("[generate-prompt] Error:", err);
    const msg = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
