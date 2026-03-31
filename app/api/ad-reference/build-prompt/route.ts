import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

export const maxDuration = 60;

const anthropic = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const formData = await req.formData();
    const imageFile = formData.get("image") as File | null;
    const label = formData.get("label") as string || "";
    const brand = formData.get("brand") as string || "";

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

    const userContext = contextParts.length > 0
      ? `\n\nContext about this ad:\n${contextParts.join("\n")}`
      : "";

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      system: `You are an ad creative analyst. Analyze advertisement images and produce a comprehensive freeform description. Return ONLY valid JSON with no markdown formatting or code blocks.`,
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
              text: `Analyze this advertisement image and produce a comprehensive description.${userContext}

Return a JSON object with a single field:

{
  "adDescription": "A comprehensive freeform analysis of this ad covering:\n\n1. Visual layout — background, product/image placement, logo, badges, score/rating treatment, price block, CTA button, typography, color scheme\n\n2. Ad copy — transcribe any visible text including headlines, body copy, descriptions, promo codes, CTAs\n\n3. Variation guidance — 3-5 bullet points on what to preserve when generating variations (key visual elements, messaging hierarchy, trust signals, price anchoring, CTA style)"
}

Write the adDescription as one cohesive natural-language block with clear sections. Be specific and detailed.

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

    // Parse JSON from response, stripping any markdown code fences
    let jsonStr = textBlock.text.trim();
    if (jsonStr.startsWith("```")) {
      jsonStr = jsonStr.replace(/^```(?:json)?\s*\n?/, "").replace(/\n?```\s*$/, "");
    }

    const result = JSON.parse(jsonStr);

    return NextResponse.json({
      adDescription: result.adDescription || "",
    });
  } catch (err) {
    console.error("Error building prompt:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to analyze image" },
      { status: 500 },
    );
  }
}
