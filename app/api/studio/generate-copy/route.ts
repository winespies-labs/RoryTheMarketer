// app/api/studio/generate-copy/route.ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getContextBundle, formatContextForPrompt } from "@/lib/context-bundle";
import { getBrand } from "@/lib/brands";

export const maxDuration = 60;

const client = new Anthropic();

interface GenerateCopyRequest {
  brand: string;
  angle: "usp" | "testimonial" | "lifestyle" | "offer";
  nanoBanana: string;
  selectedContent?: string;
}

export async function POST(req: NextRequest) {
  let body: GenerateCopyRequest;
  try {
    body = await req.json() as GenerateCopyRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { brand, angle, nanoBanana, selectedContent } = body;

  if (!getBrand(brand)) {
    return NextResponse.json({ error: "Unknown brand" }, { status: 400 });
  }

  const bundle = getContextBundle(brand);
  const contextStr = formatContextForPrompt(bundle);

  const angleInstructions: Record<string, string> = {
    usp: "Write copy that highlights the unique selling proposition. Headline should be bold and direct. primaryText elaborates on the USP benefit in 2-3 sentences.",
    testimonial: "The selectedContent is a real customer review quote — use it verbatim as primaryText. Write a headline that frames the testimonial powerfully. Keep ctaText short and action-oriented.",
    lifestyle: "Write aspirational, mood-driven copy. No specific claims. Headline evokes a feeling or moment. primaryText paints a brief lifestyle picture (2-3 sentences).",
    offer: "Write urgent, action-driving copy. Headline leads with the offer or benefit. primaryText adds supporting context in 2-3 sentences. ctaText is punchy.",
  };

  const systemPrompt = `You are a copywriter for ${brand}. You write brand-level ad copy for Meta ads.

${contextStr}

---

Generate concise, on-brand ad copy based on the angle, nano-banana, and any selected content provided.

${angleInstructions[angle] ?? ""}

Return JSON with exactly these fields:
{
  "headline": "Main headline, ≤125 characters",
  "primaryText": "2-3 sentences of body copy",
  "ctaText": "CTA button label, ≤20 characters"
}

Return ONLY the JSON. No prose, no code fences, no explanation.`;

  const userMsg = `Angle: ${angle}
Nano-banana: ${nanoBanana}${selectedContent ? `\nSelected content: ${selectedContent}` : ""}

Generate the copy.`;

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 512,
      system: systemPrompt,
      messages: [{ role: "user", content: userMsg }],
    });

    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    let jsonStr = text;
    const fence = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (fence) jsonStr = fence[1].trim();

    const result = JSON.parse(jsonStr) as {
      headline: string;
      primaryText: string;
      ctaText: string;
    };

    if (!result.headline || !result.primaryText || !result.ctaText) {
      return NextResponse.json(
        { error: "Incomplete response from Claude — missing headline, primaryText, or ctaText" },
        { status: 500 }
      );
    }

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Copy generation failed" },
      { status: 500 }
    );
  }
}
