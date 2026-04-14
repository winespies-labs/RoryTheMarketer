// app/api/ad-reference/generate-full/route.ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getContextBundle } from "@/lib/context-bundle";
import { getBrand } from "@/lib/brands";

export const maxDuration = 60;

const client = new Anthropic();

const ALLOWED_MIME_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"] as const;
type AllowedMimeType = typeof ALLOWED_MIME_TYPES[number];
const MAX_BYTES = 5 * 1024 * 1024;

function buildSystemPrompt(brandModifier: string): string {
  const brandSection = brandModifier
    ? `BRAND MODIFIER — prepend this verbatim at the top of every Gemini prompt you write:\n\n${brandModifier}\n\n---\n\n`
    : "";

  return `${brandSection}You are analyzing a reference ad image to generate structured metadata for a brand ad template library.

Study the ad layout carefully: visual composition, typography, color palette, text hierarchy, CTA style, overall mood and tone.

Return a single JSON object with exactly these fields:

{
  "label": "Short descriptive name for this template, e.g. 'Dark Lifestyle — USP Overlay'",
  "angle": "One of: usp | testimonial | lifestyle | offer",
  "nanoBanana": "One-line description of the core promise/angle this layout is optimized for",
  "adDescription": "2-4 sentence visual layout description — background treatment, text positions, composition, mood",
  "generationPrompt": "Full Gemini image generation prompt for this template. Start with the Brand Modifier verbatim (if provided). Then describe background, text layout, all elements. Use exact token placeholders listed below. End with a REQUIREMENTS section.",
  "promptOverrides": {
    "numberOfVariations": 1
  },
  "notes": "Any observations about this template's best use cases or design constraints"
}

ANGLE GUIDELINES:
- usp: Layout emphasizes a single bold brand claim or benefit statement
- testimonial: Layout has quote/review area, reviewer attribution, possibly star rating
- lifestyle: Atmospheric, brand-feeling ad without a specific claim or product focus
- offer: Layout has price elements, urgency indicators, or promotional copy

TOKEN RULES — use these EXACT placeholders in the generationPrompt for dynamic content:
- {{headline}} — main headline text, large and prominent
- {{primaryText}} — body copy, testimonial quote, or supporting text
- {{ctaText}} — CTA button label
- {{reviewerName}} — ONLY in testimonial ads: reviewer's name or attribution
- {{stars}} — ONLY in testimonial ads: star rating display (e.g. "★★★★★")
- {{usp}} — ONLY in USP ads: the unique selling proposition statement

DO NOT use wine-specific tokens ({{wineName}}, {{salePrice}}, {{score}}, {{pullQuote}}) — these are brand ads, not product ads.

THE GENERATION PROMPT MUST:
1. Start with the Brand Modifier verbatim (if provided above)
2. Describe the background precisely — hex colors, lighting direction, atmospheric effects
3. Describe each text element with position, font style, approximate size, color hex, alignment
4. Use the correct {{token}} placeholders — no literal sample copy
5. For price-free layouts: describe CTA button dimensions, border-radius, colors
6. End with REQUIREMENTS: "Output 1080×1080px. Render all text VERBATIM as provided — do not rephrase, shorten, or invent copy. Include ONLY the text elements listed above. If any {{token}} is blank, omit that element entirely and close the gap. Professional quality suitable for Meta social media advertising."

Return ONLY the JSON object. No preamble, no explanation, no markdown prose outside the JSON.`;
}

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get("image") as File | null;
    const brandId = (formData.get("brand") as string | null) ?? "winespies";

    if (!imageFile) {
      return NextResponse.json({ error: "image is required" }, { status: 400 });
    }
    if (imageFile.size > MAX_BYTES) {
      return NextResponse.json({ error: "Image must be under 5 MB" }, { status: 400 });
    }
    if (!getBrand(brandId)) {
      return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
    }

    const buffer = Buffer.from(await imageFile.arrayBuffer());
    const base64 = buffer.toString("base64");

    const rawMime = imageFile.type || "image/png";
    const mimeType: AllowedMimeType = (ALLOWED_MIME_TYPES as readonly string[]).includes(rawMime)
      ? (rawMime as AllowedMimeType)
      : "image/png";

    const bundle = getContextBundle(brandId);
    const systemPrompt = buildSystemPrompt(bundle.imagePromptModifier);

    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4096,
      system: systemPrompt,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mimeType, data: base64 },
            },
            {
              type: "text",
              text: "Analyze this ad image and return the structured JSON as specified.",
            },
          ],
        },
      ],
    });

    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    let jsonStr = text;
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) jsonStr = fence[1].trim();

    const result = JSON.parse(jsonStr);
    return NextResponse.json(result);
  } catch (err) {
    console.error("[generate-full] Error:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    );
  }
}
