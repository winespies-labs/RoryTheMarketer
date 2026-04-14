// app/api/ad-reference/batch-ingest/route.ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { getContextBundle } from "@/lib/context-bundle";
import { getBrand } from "@/lib/brands";
import { listReferenceAds, buildMarkdownFromDescription } from "@/lib/reference-ads";

export const maxDuration = 300;

const client = new Anthropic();

const ALLOWED_EXTS = new Set([".webp", ".png", ".jpg", ".jpeg"]);

function getStaticAdsDir(): string {
  return path.join(process.cwd(), "context", "Examples", "Ads", "Static");
}

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
  "generationPrompt": "Full Gemini image generation prompt. Start with Brand Modifier verbatim if provided. Describe all visual elements. Use exact {{token}} placeholders below. End with REQUIREMENTS section.",
  "promptOverrides": {
    "numberOfVariations": 1
  },
  "notes": "Any observations about this template's best use cases"
}

TOKEN RULES — use these EXACT placeholders:
- {{headline}} — main headline text
- {{primaryText}} — body copy or testimonial quote
- {{ctaText}} — CTA button label
- {{reviewerName}} — ONLY in testimonial ads
- {{stars}} — ONLY in testimonial ads
- {{usp}} — ONLY in USP ads

DO NOT use {{wineName}}, {{salePrice}}, {{score}}, or {{pullQuote}} — these are brand ads, not product ads.

THE GENERATION PROMPT MUST start with Brand Modifier (if provided), describe background (hex colors), describe each text element position/style/color, use {{token}} placeholders, and end with REQUIREMENTS: 1080×1080px, verbatim text rendering, omit blank tokens, professional Meta ad quality.

Return ONLY the JSON object. No preamble, no explanation.`;
}

function getUnregisteredImages(): string[] {
  const dir = getStaticAdsDir();
  if (!fs.existsSync(dir)) return [];

  const registered = new Set(
    listReferenceAds()
      .map((a) => a.imageFile)
      .filter(Boolean) as string[]
  );

  return fs
    .readdirSync(dir)
    .filter((f) => ALLOWED_EXTS.has(path.extname(f).toLowerCase()))
    .filter((f) => !registered.has(f));
}

export async function GET() {
  const unregistered = getUnregisteredImages();
  return NextResponse.json({ unregistered });
}

export async function POST(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const brandId = searchParams.get("brand") ?? "winespies";

  if (!getBrand(brandId)) {
    return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
  }

  const dir = getStaticAdsDir();
  if (!fs.existsSync(dir)) {
    return NextResponse.json({ created: [], errors: [] });
  }

  const bundle = await getContextBundle(brandId);
  const systemPrompt = buildSystemPrompt(bundle.imagePromptModifier);

  const imageFiles = getUnregisteredImages();
  const created: string[] = [];
  const errors: string[] = [];

  for (const filename of imageFiles) {
    try {
      const imagePath = path.join(dir, filename);
      const buffer = fs.readFileSync(imagePath);
      const base64 = buffer.toString("base64");
      const ext = path.extname(filename).toLowerCase();

      const mimeMap: Record<string, "image/webp" | "image/png" | "image/jpeg"> = {
        ".webp": "image/webp",
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
      };
      const mimeType = mimeMap[ext] ?? "image/png";

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

      const result = JSON.parse(jsonStr) as {
        label: string;
        angle: string;
        nanoBanana: string;
        adDescription: string;
        generationPrompt: string;
        promptOverrides: { numberOfVariations: number; ctaStyle?: string };
        notes: string;
      };

      const id = `${brandId}_studio_${nanoid(8)}`;
      const frontmatter: Record<string, unknown> = {
        id,
        label: result.label || filename,
        brand: brandId,
        platform: "meta",
        format: "static_image",
        type: result.angle,
        aspectRatio: "1:1",
        objective: "brand_awareness",
        angle: result.angle,
        nanoBanana: result.nanoBanana,
        imageFile: filename,
        promptTemplateId: "nano-banana-studio",
        promptOverrides: result.promptOverrides ?? { numberOfVariations: 1 },
        notes: result.notes,
      };

      // Remove undefined values
      for (const key of Object.keys(frontmatter)) {
        if (frontmatter[key] === undefined) delete frontmatter[key];
      }

      const markdown = buildMarkdownFromDescription(
        frontmatter,
        result.adDescription,
        result.generationPrompt
      );

      fs.writeFileSync(path.join(dir, `${id}.md`), markdown, "utf8");
      created.push(filename);
    } catch (err) {
      errors.push(`${filename}: ${err instanceof Error ? err.message : "Unknown error"}`);
    }
  }

  return NextResponse.json({ created, errors });
}
