import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const anthropic = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get("image") as File | null;
    const label = (formData.get("label") as string) || "";
    const brand = (formData.get("brand") as string) || "";

    if (!imageFile) {
      return NextResponse.json({ error: "Image file is required" }, { status: 400 });
    }

    const buffer = Buffer.from(await imageFile.arrayBuffer());
    const base64 = buffer.toString("base64");

    const ext = imageFile.name.split(".").pop()?.toLowerCase() || "png";
    const mimeMap: Record<string, string> = {
      png: "image/png",
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      webp: "image/webp",
      gif: "image/gif",
    };
    const mediaType = mimeMap[ext] || "image/png";

    const contextParts: string[] = [];
    if (label) contextParts.push(`Ad label: ${label}`);
    if (brand) contextParts.push(`Brand: ${brand}`);
    const userContext =
      contextParts.length > 0 ? `\n\nContext about this ad:\n${contextParts.join("\n")}` : "";

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 4000,
      system: `You are an expert performance marketing creative director and Nano Banana 2 (Google Gemini image generation) prompt engineer specializing in Wine Spies — a dark-aesthetic, flash-sale wine retailer. You analyze ad images and produce two outputs: a freeform ad description AND a complete, production-ready Nano Banana 2 generation prompt.

Wine Spies brand context:
- Aesthetic: dark, moody, premium. Deep blacks (#0A0A0A) with rich burgundy/crimson atmospheric smoke effects.
- Trust signals: "Excellent ★★★★★ 1300+ reviews on Trustpilot" badge always near the logo.
- Logo: white "wine spies" wordmark, two stacked lines ("wine" / "spies"), clean sans-serif.
- Value proposition: dramatic price anchoring (retail vs sale), critic scores as credibility engine.
- CTA style: direct, action-oriented ("Shop This Deal →", "Get This Deal", "Claim Your Bottle").

Return ONLY valid JSON with no markdown formatting or code blocks.`,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: {
                type: "base64",
                media_type: mediaType as "image/png" | "image/jpeg" | "image/webp" | "image/gif",
                data: base64,
              },
            },
            {
              type: "text",
              text: `Analyze this Wine Spies advertisement image and produce two outputs.${userContext}

Return a JSON object with exactly two fields:

{
  "adDescription": "...",
  "generationPrompt": "..."
}

--- adDescription ---
A comprehensive freeform analysis covering:
1. Visual layout — background, product placement, logo, badges, score/rating, price block, CTA, typography, color scheme
2. Ad copy — transcribe all visible text verbatim
3. Variation guidance — 3-5 bullet points on what to preserve when generating variations

--- generationPrompt ---
A complete, standalone, immediately-usable Nano Banana 2 (Google Gemini image generation) prompt that recreates this exact template design with dynamic wine data substituted via {{tokens}}.

Available tokens:
- {{wineName}} — wine display name (vintage + producer + wine name)
- {{score}} — critic score string like "98 pts — Wine Spectator" (may be blank — if blank, omit the element)
- {{pullQuote}} — short body copy / tasting note
- {{salePrice}} — sale price like "$129"
- {{retailPrice}} — retail/original price like "$199"
- {{ctaText}} — call-to-action button text

The generationPrompt must:
1. Open with: "Use the attached images as brand reference. Create a [dimensions] [aspect ratio] wine offer advertisement for Wine Spies."
2. Describe BACKGROUND: exact color (hex), atmospheric effects, mood
3. Describe BOTTLE placement: position, size, lighting, how the background frames it
4. Describe TOP BRANDING: logo position and style, Trustpilot badge text and position
5. Describe TEXT HIERARCHY: each text element in order (score, wine name, body copy) with position, estimated font size in px, weight, color (hex)
6. Insert the correct {{token}} for each dynamic text element
7. Describe PRICE BLOCK in detail: pill/badge shape with EXACT pixel dimensions (width × height), EXACT border-radius in px, exact hex colors for each pill (retail = white bg / black text, sale = red bg / white text)
8. Describe CTA BUTTON: exact border-radius in px (distinguish from pill-shaped or square), fill color (hex), text color (hex), font weight
9. End with REQUIREMENTS: output pixel dimensions, all text verbatim/no invented copy, omit blank tokens gracefully, professional Meta ad quality

Be precise and specific. No [brackets] or placeholders — write it as a finished, ready-to-use prompt.

Return ONLY the JSON object, no other text.`,
            },
          ],
        },
      ],
    });

    const textBlock = response.content.find((b) => b.type === "text");
    if (!textBlock || textBlock.type !== "text") {
      return NextResponse.json({ error: "No text response from Claude" }, { status: 500 });
    }

    // Strip markdown code fences if present
    let jsonStr = textBlock.text.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
    }

    const result = JSON.parse(jsonStr);

    return NextResponse.json({
      adDescription: result.adDescription || "",
      generationPrompt: result.generationPrompt || "",
    });
  } catch (err) {
    console.error("Error building prompt:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to analyze image" },
      { status: 500 },
    );
  }
}
