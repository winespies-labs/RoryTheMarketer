import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getBrand } from "@/lib/brands";
import { getContextBundle, formatContextForPrompt } from "@/lib/context-bundle";
import { formatReviewSnippetsForPrompt } from "@/lib/reviews-storage";

const client = new Anthropic();

export const maxDuration = 60;

export type AdCopyOutput = {
  headlines: string[];
  primaryText: string;
  description?: string;
  ctaOptions: string[];
};

/** Strip markdown code blocks and parse JSON object. */
function extractJsonObject(text: string): AdCopyOutput {
  let raw = text.trim();
  const codeBlock = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) raw = codeBlock[1].trim();
  const start = raw.indexOf("{");
  if (start !== -1) {
    const end = raw.lastIndexOf("}");
    if (end > start) raw = raw.slice(start, end + 1);
  }
  return JSON.parse(raw) as AdCopyOutput;
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const brandId = (body.brand as string | undefined) ?? undefined;
  const offerContext = (body.offerContext as string | undefined)?.trim() ?? "";
  const persona = (body.persona as string | undefined)?.trim() ?? "";
  const instructions = (body.instructions as string | undefined)?.trim() ?? "";
  const includeReviewSnippets = body.includeReviewSnippets !== false;

  if (!brandId || !getBrand(brandId)) {
    return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
  }

  const bundle = getContextBundle(brandId);
  const contextText = formatContextForPrompt(bundle);

  const reviewSnippetsBlock =
    includeReviewSnippets
      ? await formatReviewSnippetsForPrompt(brandId, {
          limit: 12,
          maxCharsPerReview: 200,
        })
      : "";

  const systemPrompt = `You are an expert Meta (Facebook/Instagram) ad copywriter. You write conversion-focused ad copy that matches the brand voice and uses USPs and customer proof.

${contextText}
${reviewSnippetsBlock}

Rules:
- Headlines: short, punchy, under ~40 characters when possible; multiple options for testing.
- Primary text: main body; lead with the hook; use line breaks for readability; keep within Meta best practices (no excessive caps, no prohibited claims).
- Description: optional secondary line (e.g. under headline in some placements).
- CTA options: 2–4 call-to-action button text ideas (e.g. Shop Now, Learn More, Get Offer).
- Use review themes and USPs naturally; you may paraphrase or quote from the review snippets when it fits.
- Match the brand voice exactly.`;

  const userParts: string[] = [];
  if (offerContext) {
    userParts.push(`Offer / campaign focus:\n${offerContext}`);
  }
  if (persona) {
    userParts.push(`Target persona: ${persona}`);
  }
  if (instructions) {
    userParts.push(`Additional instructions:\n${instructions}`);
  }
  if (userParts.length === 0) {
    userParts.push("Generate Facebook ad copy options using the brand context above. Focus on the main USPs and review themes.");
  }

  userParts.push("");
  userParts.push("OUTPUT FORMAT: Reply with ONLY a single JSON object. No markdown, no code fences, no text before or after.");
  userParts.push('Keys: "headlines" (array of strings), "primaryText" (string), "description" (string, optional), "ctaOptions" (array of strings).');
  userParts.push('Example: {"headlines":["...","..."],"primaryText":"...","description":"...","ctaOptions":["Shop Now","Get Offer"]}');

  const userPrompt = userParts.join("\n\n");

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2048,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text =
      msg.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("") || "{}";

    const output = extractJsonObject(text);
    if (!Array.isArray(output.headlines)) output.headlines = [];
    if (typeof output.primaryText !== "string") output.primaryText = "";
    if (!Array.isArray(output.ctaOptions)) output.ctaOptions = [];

    return NextResponse.json(output);
  } catch (err) {
    console.error("ad-builder/copy:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to generate copy" },
      { status: 500 }
    );
  }
}
