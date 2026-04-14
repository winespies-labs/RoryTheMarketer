# Creative Ad Studio Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a brand-level Creative Ad Studio at `/creative/ad-builder/studio` that ingests reference ad images, auto-generates Gemini prompts via Claude Vision, and provides a 4-step wizard to create brand ads (USP, testimonial, lifestyle, offer).

**Architecture:** Three sub-systems working together: (1) an ingestion pipeline that uses Claude Vision to analyze reference images and produce structured Gemini prompts with {{token}} placeholders, (2) a batch-ingest route that processes the 14 existing static ad images, and (3) a 4-step wizard (Pick Style → Configure Content → Generate → Download/Publish) that resolves tokens into the stored prompt and calls Gemini.

**Tech Stack:** Next.js App Router, TypeScript strict, Anthropic SDK (claude-sonnet-4-6), Google GenAI (gemini-3-pro-image-preview), Tailwind CSS 4 with CSS variables, existing `lib/reference-ads.ts` CRUD functions, existing `POST /api/pdp/publish` for Meta publish.

---

## File Map

| File | Action |
|------|--------|
| `lib/ad-builder.ts` | Modify — add `"usp"` to `AdType` union and `AD_TYPE_CONFIG` |
| `app/api/ad-reference/generate-full/route.ts` | New — Claude Vision → full structured JSON |
| `app/api/ad-reference/batch-ingest/route.ts` | New — scan Static folder, ingest unregistered images |
| `app/api/studio/generate-copy/route.ts` | New — brand-level Claude copy generation |
| `app/api/studio/generate/route.ts` | New — Gemini image generation with token resolution |
| `app/api/studio/usps/route.ts` | New — serve USPs from context bundle |
| `app/creative/ad-builder/studio/hooks/useStudioStyles.ts` | New — fetch + filter reference ads for Studio |
| `app/creative/ad-builder/studio/components/StylePicker.tsx` | New — Step 1: grid with angle badges + Add Template + Ingest |
| `app/creative/ad-builder/studio/components/ContentConfigurator.tsx` | New — Step 2: angle-adaptive content form |
| `app/creative/ad-builder/studio/components/GeneratePanel.tsx` | New — Step 3: generate/regenerate UI |
| `app/creative/ad-builder/studio/components/DownloadPublishPanel.tsx` | New — Step 4: download + Meta publish |
| `app/creative/ad-builder/studio/page.tsx` | Modify — replace stub with 4-step wizard |

---

## Task 1: Add `"usp"` to AdType

**Files:**
- Modify: `lib/ad-builder.ts`

- [ ] **Step 1: Add `"usp"` to the union and config**

Open `lib/ad-builder.ts`. Change line 5 and add the config entry:

```typescript
// Line 5 — change this:
export type AdType = "pdp" | "testimonial" | "comparison" | "offer" | "ugc" | "lifestyle";

// To this:
export type AdType = "pdp" | "testimonial" | "comparison" | "offer" | "ugc" | "lifestyle" | "usp";
```

Then in `AD_TYPE_CONFIG`, add after the `lifestyle` entry:

```typescript
  usp: {
    label: "USP / Brand Statement",
    color: "bg-indigo-100 border-indigo-300",
    textColor: "text-indigo-800",
    description: "Unique selling proposition or brand statement ad",
    fields: ["headline", "usp", "ctaText"],
  },
```

- [ ] **Step 2: Verify TypeScript accepts the change**

```bash
cd /Users/mikemeisner/Developer/RoryTheMarketer && npx tsc --noEmit 2>&1 | head -20
```

Expected: no errors related to `AdType`.

- [ ] **Step 3: Commit**

```bash
git add lib/ad-builder.ts
git commit -m "feat: add usp to AdType union and AD_TYPE_CONFIG"
```

---

## Task 2: Create `generate-full` Route

**Files:**
- Create: `app/api/ad-reference/generate-full/route.ts`

This route accepts a multipart form with an `image` file + optional `brand` param. It calls Claude Vision with a structured system prompt (brand modifier + Nano-Banana + token rules) and returns a JSON object with all fields needed to create a reference ad markdown file.

- [ ] **Step 1: Create the route file**

```typescript
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
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/ad-reference/generate-full/route.ts
git commit -m "feat: add generate-full route — Claude Vision to structured JSON"
```

---

## Task 3: Create `batch-ingest` Route

**Files:**
- Create: `app/api/ad-reference/batch-ingest/route.ts`

GET returns `{ unregistered: string[] }` — image filenames with no corresponding `.md`. POST ingests all unregistered images by calling Claude Vision for each and writing `.md` files. Images are not moved or renamed — they stay in place.

- [ ] **Step 1: Create the route file**

```typescript
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
    return NextResponse.json({ created: [], skipped: [], errors: [] });
  }

  const bundle = getContextBundle(brandId);
  const systemPrompt = buildSystemPrompt(bundle.imagePromptModifier);

  const imageFiles = getUnregisteredImages();
  const created: string[] = [];
  const skipped: string[] = [];
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

      const id = `winespies_studio_${nanoid(8)}`;
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

  return NextResponse.json({ created, skipped, errors });
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/ad-reference/batch-ingest/route.ts
git commit -m "feat: add batch-ingest route — scan and ingest unregistered ad images"
```

---

## Task 4: Create `generate-copy` and `usps` Routes

**Files:**
- Create: `app/api/studio/generate-copy/route.ts`
- Create: `app/api/studio/usps/route.ts`

- [ ] **Step 1: Create the generate-copy route**

```typescript
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

    return NextResponse.json(result);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Copy generation failed" },
      { status: 500 }
    );
  }
}
```

- [ ] **Step 2: Create the usps route**

```typescript
// app/api/studio/usps/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getBrand } from "@/lib/brands";
import { getContextBundle } from "@/lib/context-bundle";

export async function GET(req: NextRequest) {
  const brandId = req.nextUrl.searchParams.get("brand") ?? "winespies";
  if (!getBrand(brandId)) {
    return NextResponse.json({ error: "Unknown brand" }, { status: 400 });
  }
  const bundle = getContextBundle(brandId);
  return NextResponse.json({ usps: bundle.usps });
}
```

- [ ] **Step 3: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 4: Commit**

```bash
git add app/api/studio/generate-copy/route.ts app/api/studio/usps/route.ts
git commit -m "feat: add studio generate-copy and usps API routes"
```

---

## Task 5: Create `studio/generate` Route

**Files:**
- Create: `app/api/studio/generate/route.ts`

Accepts `{ styleId, tokens }`, resolves `{{tokens}}` into the stored generationPrompt, calls Gemini, returns `{ images: [{ base64, mimeType }] }`.

- [ ] **Step 1: Create the route file**

```typescript
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
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add app/api/studio/generate/route.ts
git commit -m "feat: add studio/generate route — Gemini image gen with token resolution"
```

---

## Task 6: Create `useStudioStyles` Hook

**Files:**
- Create: `app/creative/ad-builder/studio/hooks/useStudioStyles.ts`

Fetches the reference ad list and the unregistered image count in parallel. Filters out `pdp` type ads.

- [ ] **Step 1: Create the hook**

```typescript
// app/creative/ad-builder/studio/hooks/useStudioStyles.ts
"use client";

import { useState, useEffect, useCallback } from "react";

const STUDIO_TYPES = new Set(["usp", "testimonial", "lifestyle", "offer", "ugc", "comparison"]);

export interface StudioStyle {
  id: string;
  label: string;
  angle: string | null;
  nanoBanana: string | null;
  imageFile: string | null;
  type: string | null;
  aspectRatio: string | null;
  notes: string | null;
}

export function useStudioStyles(brand = "winespies") {
  const [styles, setStyles] = useState<StudioStyle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unregisteredCount, setUnregisteredCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`/api/ad-reference/list?brand=${brand}`).then((r) => {
        if (!r.ok) throw new Error(`List fetch failed: ${r.status}`);
        return r.json() as Promise<{ referenceAds: StudioStyle[] }>;
      }),
      fetch(`/api/ad-reference/batch-ingest`).then((r) => {
        if (!r.ok) return { unregistered: [] };
        return r.json() as Promise<{ unregistered: string[] }>;
      }),
    ])
      .then(([listData, batchData]) => {
        const all = listData.referenceAds ?? [];
        const filtered = all.filter(
          (a) => !a.type || STUDIO_TYPES.has(a.type)
        );
        setStyles(filtered);
        setUnregisteredCount(batchData.unregistered?.length ?? 0);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load styles");
        setLoading(false);
      });
  }, [brand, refreshKey]);

  return { styles, loading, error, unregisteredCount, refresh };
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add app/creative/ad-builder/studio/hooks/useStudioStyles.ts
git commit -m "feat: add useStudioStyles hook — fetch and filter brand-level reference ads"
```

---

## Task 7: Create `StylePicker` Component

**Files:**
- Create: `app/creative/ad-builder/studio/components/StylePicker.tsx`

Grid of reference ad cards with angle badges. Includes an "Add Template" card with upload form that calls `generate-full` then `create`. Shows a batch-ingest button when unregistered images exist.

- [ ] **Step 1: Create the component**

```typescript
// app/creative/ad-builder/studio/components/StylePicker.tsx
"use client";

import { useState, useRef } from "react";
import { useStudioStyles, type StudioStyle } from "../hooks/useStudioStyles";

const ANGLE_BADGE: Record<string, { label: string; cls: string }> = {
  usp:         { label: "USP",         cls: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  testimonial: { label: "Testimonial", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  lifestyle:   { label: "Lifestyle",   cls: "bg-pink-100 text-pink-700 border-pink-200" },
  offer:       { label: "Offer",       cls: "bg-red-100 text-red-700 border-red-200" },
  ugc:         { label: "UGC",         cls: "bg-green-100 text-green-700 border-green-200" },
  comparison:  { label: "Comparison",  cls: "bg-blue-100 text-blue-700 border-blue-200" },
};

function AngleBadge({ angle }: { angle: string | null }) {
  if (!angle) return null;
  const badge = ANGLE_BADGE[angle];
  if (!badge) return null;
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${badge.cls}`}>
      {badge.label}
    </span>
  );
}

function StyleCard({
  style,
  selected,
  onSelect,
}: {
  style: StudioStyle;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative w-full text-left rounded-xl border transition-all ${
        selected
          ? "border-accent bg-accent/5 ring-1 ring-accent"
          : "border-border bg-surface hover:border-accent/40"
      }`}
    >
      {/* Selection indicator */}
      <div
        className={`absolute top-2 right-2 z-10 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
          selected ? "border-accent bg-accent" : "border-border bg-surface"
        }`}
      >
        {selected && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>

      {/* Image */}
      <div className="w-full aspect-square rounded-t-xl overflow-hidden bg-background">
        {style.id ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/ad-reference/image?id=${style.id}`}
            alt={style.label}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted/40">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>

      {/* Label + badge */}
      <div className="p-3 flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-foreground truncate flex-1">{style.label}</p>
        <AngleBadge angle={style.angle} />
      </div>
    </button>
  );
}

function AddTemplateCard({ brand, onSaved }: { brand: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState<{
    label: string;
    angle: string;
    nanoBanana: string;
    adDescription: string;
    generationPrompt: string;
    promptOverrides: { numberOfVariations: number };
    notes: string;
  } | null>(null);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (file: File) => {
    setImageFile(file);
    setAnalyzed(null);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!imageFile) return;
    setAnalyzing(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("image", imageFile);
      fd.append("brand", brand);
      const res = await fetch("/api/ad-reference/generate-full", { method: "POST", body: fd });
      if (!res.ok) {
        const d = await res.json() as { error: string };
        throw new Error(d.error);
      }
      const data = await res.json() as typeof analyzed;
      setAnalyzed(data);
      setLabel(data?.label ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    }
    setAnalyzing(false);
  };

  const handleSave = async () => {
    if (!imageFile || !analyzed) return;
    setSaving(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("image", imageFile);
      fd.append("data", JSON.stringify({
        label: label || analyzed.label,
        brand,
        platform: "meta",
        format: "static_image",
        type: analyzed.angle,
        aspectRatio: "1:1",
        angle: analyzed.angle,
        nanoBanana: analyzed.nanoBanana,
        adDescription: analyzed.adDescription,
        generationPrompt: analyzed.generationPrompt,
        promptOverrides: analyzed.promptOverrides,
        notes: analyzed.notes,
      }));
      const res = await fetch("/api/ad-reference/create", { method: "POST", body: fd });
      if (!res.ok) {
        const d = await res.json() as { error: string };
        throw new Error(d.error);
      }
      setOpen(false);
      setImageFile(null);
      setImagePreview(null);
      setAnalyzed(null);
      setLabel("");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
    setSaving(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full aspect-square rounded-xl border-2 border-dashed border-border hover:border-accent/50 bg-surface hover:bg-accent/5 flex flex-col items-center justify-center gap-2 transition-all text-muted hover:text-accent"
      >
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        <span className="text-xs font-medium">Add Template</span>
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-accent/30 bg-surface p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Add Template</p>
        <button type="button" onClick={() => { setOpen(false); setImageFile(null); setImagePreview(null); setAnalyzed(null); }} className="text-muted hover:text-foreground text-xs">Cancel</button>
      </div>

      {/* Image upload */}
      <div
        className="w-full aspect-square rounded-lg border-2 border-dashed border-border bg-background flex items-center justify-center cursor-pointer overflow-hidden"
        onClick={() => fileRef.current?.click()}
      >
        {imagePreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
        ) : (
          <span className="text-xs text-muted">Click to upload image</span>
        )}
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileChange(f); }}
      />

      {imageFile && !analyzed && (
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={analyzing}
          className="w-full py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 transition-colors"
        >
          {analyzing ? "Analyzing..." : "Analyze with Claude"}
        </button>
      )}

      {analyzed && (
        <>
          <div>
            <label className="text-xs text-muted block mb-1">Name</label>
            <input
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">Angle detected: <span className="font-medium text-foreground">{analyzed.angle}</span></label>
            <label className="text-xs text-muted block mb-1">Nano-banana: <span className="text-foreground">{analyzed.nanoBanana}</span></label>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Save Template"}
          </button>
        </>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

export default function StylePicker({
  selected,
  onSelect,
  brand = "winespies",
}: {
  selected: StudioStyle | null;
  onSelect: (style: StudioStyle) => void;
  brand?: string;
}) {
  const { styles, loading, error, unregisteredCount, refresh } = useStudioStyles(brand);
  const [ingesting, setIngesting] = useState(false);
  const [ingestMsg, setIngestMsg] = useState<string | null>(null);

  const handleIngest = async () => {
    setIngesting(true);
    setIngestMsg(null);
    try {
      const res = await fetch(`/api/ad-reference/batch-ingest?brand=${brand}`, { method: "POST" });
      const data = await res.json() as { created: string[]; errors: string[] };
      const msg = `Ingested ${data.created.length} image(s)${data.errors.length ? ` • ${data.errors.length} error(s)` : ""}`;
      setIngestMsg(msg);
      refresh();
    } catch (e) {
      setIngestMsg(e instanceof Error ? e.message : "Ingest failed");
    }
    setIngesting(false);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Ingest banner */}
      {unregisteredCount > 0 && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-200">
          <p className="text-sm text-amber-800">
            {unregisteredCount} unregistered image{unregisteredCount > 1 ? "s" : ""} found in Static folder.
          </p>
          <button
            type="button"
            onClick={handleIngest}
            disabled={ingesting}
            className="text-sm font-medium text-amber-700 hover:text-amber-900 disabled:opacity-50"
          >
            {ingesting ? "Ingesting..." : "Ingest all"}
          </button>
        </div>
      )}
      {ingestMsg && <p className="text-xs text-muted">{ingestMsg}</p>}

      {/* Loading / error */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted py-8 justify-center">
          <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          Loading styles...
        </div>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}

      {/* Empty state (no templates yet) */}
      {!loading && styles.length === 0 && unregisteredCount === 0 && (
        <div className="text-center py-8 text-muted text-sm">
          No templates yet. Add one below or drop images in{" "}
          <code className="text-xs bg-surface px-1 rounded">context/Examples/Ads/Static/</code>.
        </div>
      )}

      {/* Grid */}
      {!loading && (
        <div className="grid grid-cols-2 gap-3">
          {styles.map((style) => (
            <StyleCard
              key={style.id}
              style={style}
              selected={selected?.id === style.id}
              onSelect={() => onSelect(style)}
            />
          ))}
          <AddTemplateCard brand={brand} onSaved={refresh} />
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add app/creative/ad-builder/studio/components/StylePicker.tsx
git commit -m "feat: add StylePicker — style grid with angle badges, Add Template, and batch ingest"
```

---

## Task 8: Create `ContentConfigurator` Component

**Files:**
- Create: `app/creative/ad-builder/studio/components/ContentConfigurator.tsx`

Angle-adaptive Step 2. Loads USPs or reviews based on angle, calls `generate-copy` for initial content suggestions, renders editable fields.

- [ ] **Step 1: Create the component**

```typescript
// app/creative/ad-builder/studio/components/ContentConfigurator.tsx
"use client";

import { useState, useEffect } from "react";
import type { StudioStyle } from "../hooks/useStudioStyles";

export interface ContentTokens {
  headline: string;
  primaryText: string;
  ctaText: string;
  reviewerName: string;
  stars: string;
  usp: string;
}

interface Review {
  id: string;
  text: string;
  author: string;
  rating: number;
}

function Field({
  label,
  value,
  onChange,
  multiline = false,
  placeholder = "",
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
}) {
  return (
    <div>
      <label className="text-xs font-medium text-muted block mb-1">{label}</label>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-surface focus:outline-none focus:border-accent resize-none"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-surface focus:outline-none focus:border-accent"
        />
      )}
    </div>
  );
}

export default function ContentConfigurator({
  style,
  brand,
  onComplete,
  onBack,
}: {
  style: StudioStyle;
  brand: string;
  onComplete: (tokens: ContentTokens) => void;
  onBack: () => void;
}) {
  const angle = style.angle ?? "lifestyle";

  const [tokens, setTokens] = useState<ContentTokens>({
    headline: "",
    primaryText: "",
    ctaText: "Shop Now",
    reviewerName: "",
    stars: "",
    usp: "",
  });
  const [generating, setGenerating] = useState(false);
  const [usps, setUsps] = useState<string[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [selectedUsp, setSelectedUsp] = useState("");
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  // Load context data
  useEffect(() => {
    if (angle === "usp") {
      fetch(`/api/studio/usps?brand=${brand}`)
        .then((r) => r.json())
        .then((data: { usps: string }) => {
          const lines = data.usps
            .split("\n")
            .map((l) => l.replace(/^[-*]\s*/, "").trim())
            .filter(Boolean);
          setUsps(lines);
        })
        .catch(console.error);
    }
    if (angle === "testimonial") {
      fetch(`/api/reviews?brand=${brand}&minRating=4&limit=5`)
        .then((r) => r.json())
        .then((data: { page: Review[] }) => setReviews(data.page ?? []))
        .catch(console.error);
    }
  }, [angle, brand]);

  // Auto-generate copy for lifestyle and offer on mount
  useEffect(() => {
    if (angle === "lifestyle" || angle === "offer") {
      generateCopy();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generateCopy = async (selectedContent?: string) => {
    setGenerating(true);
    setCopyError(null);
    try {
      const res = await fetch("/api/studio/generate-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand,
          angle,
          nanoBanana: style.nanoBanana ?? "",
          selectedContent,
        }),
      });
      if (!res.ok) {
        const d = await res.json() as { error: string };
        throw new Error(d.error);
      }
      const data = await res.json() as { headline: string; primaryText: string; ctaText: string };
      setTokens((prev) => ({
        ...prev,
        headline: data.headline,
        primaryText: data.primaryText,
        ctaText: data.ctaText,
      }));
    } catch (e) {
      setCopyError(e instanceof Error ? e.message : "Copy generation failed");
    }
    setGenerating(false);
  };

  const handleUspSelect = (usp: string) => {
    setSelectedUsp(usp);
    setTokens((prev) => ({ ...prev, usp }));
    generateCopy(usp);
  };

  const handleReviewSelect = (review: Review) => {
    setSelectedReview(review);
    setTokens((prev) => ({
      ...prev,
      primaryText: review.text,
      reviewerName: review.author,
      stars: "★".repeat(review.rating),
    }));
    generateCopy(review.text);
  };

  const update = (key: keyof ContentTokens) => (val: string) =>
    setTokens((prev) => ({ ...prev, [key]: val }));

  const canProceed = tokens.headline.trim().length > 0 && tokens.ctaText.trim().length > 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Configure Content</h2>
          <p className="text-xs text-muted mt-0.5">
            Style: <span className="font-medium text-foreground">{style.label}</span>
            {style.angle && (
              <span className="ml-2 capitalize">· {style.angle}</span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-muted hover:text-foreground"
        >
          ← Back
        </button>
      </div>

      {/* USP angle: USP picker */}
      {angle === "usp" && usps.length > 0 && (
        <div>
          <label className="text-xs font-medium text-muted block mb-2">Select a USP</label>
          <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
            {usps.map((usp, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleUspSelect(usp)}
                className={`w-full text-left px-3 py-2 text-sm rounded-lg border transition-colors ${
                  selectedUsp === usp
                    ? "border-accent bg-accent/5"
                    : "border-border bg-surface hover:border-accent/40"
                }`}
              >
                {usp}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Testimonial angle: review picker */}
      {angle === "testimonial" && reviews.length > 0 && (
        <div>
          <label className="text-xs font-medium text-muted block mb-2">Select a review</label>
          <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
            {reviews.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => handleReviewSelect(r)}
                className={`w-full text-left px-3 py-2.5 text-sm rounded-lg border transition-colors ${
                  selectedReview?.id === r.id
                    ? "border-accent bg-accent/5"
                    : "border-border bg-surface hover:border-accent/40"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-amber-500">{"★".repeat(r.rating)}</span>
                  <span className="text-xs text-muted">{r.author}</span>
                </div>
                <p className="text-xs leading-relaxed line-clamp-3">{r.text}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Testimonial / empty fallback */}
      {angle === "testimonial" && reviews.length === 0 && (
        <p className="text-xs text-muted">No high-rated reviews available. Enter copy manually below.</p>
      )}

      {/* Generating indicator */}
      {generating && (
        <div className="flex items-center gap-2 text-sm text-muted">
          <div className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          Drafting copy...
        </div>
      )}
      {copyError && <p className="text-xs text-danger">{copyError}</p>}

      {/* Generate copy button (USP after selection, or re-generate anytime) */}
      {(angle === "lifestyle" || angle === "offer" || (angle === "usp" && !selectedUsp) || (angle === "testimonial" && !selectedReview)) && (
        <button
          type="button"
          onClick={() => generateCopy()}
          disabled={generating}
          className="self-start px-4 py-2 text-sm border border-border rounded-lg hover:border-accent transition-colors disabled:opacity-50"
        >
          {generating ? "Generating..." : "Draft with Claude"}
        </button>
      )}

      {/* Editable fields */}
      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <p className="text-xs font-medium text-muted uppercase tracking-wide">Review & edit copy</p>

        <Field label="Headline" value={tokens.headline} onChange={update("headline")} placeholder="Main headline..." />
        <Field label="Body copy" value={tokens.primaryText} onChange={update("primaryText")} multiline placeholder="Supporting copy or testimonial quote..." />
        <Field label="CTA" value={tokens.ctaText} onChange={update("ctaText")} placeholder="Shop Now" />

        {angle === "testimonial" && (
          <>
            <Field label="Reviewer name" value={tokens.reviewerName} onChange={update("reviewerName")} placeholder="Jane D." />
            <Field label="Stars (e.g. ★★★★★)" value={tokens.stars} onChange={update("stars")} placeholder="★★★★★" />
          </>
        )}

        {angle === "usp" && (
          <Field label="USP statement" value={tokens.usp} onChange={update("usp")} placeholder="Direct access to wines most people never find..." />
        )}
      </div>

      <button
        type="button"
        onClick={() => onComplete(tokens)}
        disabled={!canProceed}
        className="w-full py-2.5 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-40 transition-colors font-medium"
      >
        Continue to Generate
      </button>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add app/creative/ad-builder/studio/components/ContentConfigurator.tsx
git commit -m "feat: add ContentConfigurator — angle-adaptive Step 2 for studio wizard"
```

---

## Task 9: Create `GeneratePanel` Component

**Files:**
- Create: `app/creative/ad-builder/studio/components/GeneratePanel.tsx`

- [ ] **Step 1: Create the component**

```typescript
// app/creative/ad-builder/studio/components/GeneratePanel.tsx
"use client";

import { useState } from "react";
import type { StudioStyle } from "../hooks/useStudioStyles";
import type { ContentTokens } from "./ContentConfigurator";

export interface GeneratedImage {
  base64: string;
  mimeType: string;
}

export default function GeneratePanel({
  style,
  tokens,
  onBack,
  onGenerated,
}: {
  style: StudioStyle;
  tokens: ContentTokens;
  onBack: () => void;
  onGenerated: (images: GeneratedImage[]) => void;
}) {
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setGenerating(true);
    setError(null);

    // Build token map from ContentTokens (omit empty strings)
    const tokenMap: Record<string, string> = {};
    for (const [k, v] of Object.entries(tokens)) {
      if (v) tokenMap[k] = v;
    }

    try {
      const res = await fetch("/api/studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ styleId: style.id, tokens: tokenMap }),
      });
      const data = await res.json() as { images?: GeneratedImage[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      const imgs = data.images ?? [];
      setImages(imgs);
      onGenerated(imgs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    }
    setGenerating(false);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Generate</h2>
          <p className="text-xs text-muted mt-0.5">Style: <span className="font-medium text-foreground">{style.label}</span></p>
        </div>
        <button type="button" onClick={onBack} className="text-sm text-muted hover:text-foreground">
          ← Back
        </button>
      </div>

      {/* Token summary */}
      <div className="p-3 rounded-lg bg-surface border border-border text-xs space-y-1">
        {tokens.headline && <p><span className="text-muted">Headline:</span> {tokens.headline}</p>}
        {tokens.ctaText && <p><span className="text-muted">CTA:</span> {tokens.ctaText}</p>}
        {tokens.reviewerName && <p><span className="text-muted">Reviewer:</span> {tokens.reviewerName}</p>}
      </div>

      {/* Generate button */}
      {images.length === 0 && (
        <button
          type="button"
          onClick={generate}
          disabled={generating}
          className="w-full py-3 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 transition-colors font-medium"
        >
          {generating ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Generating...
            </span>
          ) : "Generate Ad"}
        </button>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      {/* Generated images */}
      {images.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className={`grid gap-3 ${images.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
            {images.map((img, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={`data:${img.mimeType};base64,${img.base64}`}
                alt={`Generated ad ${i + 1}`}
                className="w-full rounded-xl border border-border"
              />
            ))}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={generate}
              disabled={generating}
              className="flex-1 py-2.5 text-sm border border-border rounded-lg hover:border-accent transition-colors disabled:opacity-50"
            >
              {generating ? "Regenerating..." : "Regenerate"}
            </button>
            <button
              type="button"
              onClick={() => onGenerated(images)}
              className="flex-1 py-2.5 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors font-medium"
            >
              Continue →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add app/creative/ad-builder/studio/components/GeneratePanel.tsx
git commit -m "feat: add GeneratePanel — generate and regenerate UI for studio wizard"
```

---

## Task 10: Create `DownloadPublishPanel` Component

**Files:**
- Create: `app/creative/ad-builder/studio/components/DownloadPublishPanel.tsx`

Download button per image. Publish to Meta button that reuses `POST /api/pdp/publish`. Meta publish requires selecting a campaign and ad set.

- [ ] **Step 1: Create the component**

```typescript
// app/creative/ad-builder/studio/components/DownloadPublishPanel.tsx
"use client";

import { useState, useEffect } from "react";
import type { GeneratedImage } from "./GeneratePanel";

interface Campaign {
  id: string;
  name: string;
  status: string;
}

interface AdSet {
  id: string;
  name: string;
  status: string;
}

interface PublishResult {
  imageIndex: number;
  success: boolean;
  adId?: string;
  error?: string;
}

export default function DownloadPublishPanel({
  images,
  brand,
  headline,
  primaryText,
  onBack,
}: {
  images: GeneratedImage[];
  brand: string;
  headline: string;
  primaryText: string;
  onBack: () => void;
}) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [adSets, setAdSets] = useState<AdSet[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [selectedAdSet, setSelectedAdSet] = useState("");
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [loadingAdSets, setLoadingAdSets] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishResults, setPublishResults] = useState<PublishResult[]>([]);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [showPublishPanel, setShowPublishPanel] = useState(false);

  const download = (img: GeneratedImage, index: number) => {
    const ext = img.mimeType.split("/")[1] || "png";
    const a = document.createElement("a");
    a.href = `data:${img.mimeType};base64,${img.base64}`;
    a.download = `studio-ad-${index + 1}.${ext}`;
    a.click();
  };

  const loadCampaigns = async () => {
    setLoadingCampaigns(true);
    try {
      const res = await fetch(`/api/pdp/publish?action=campaigns&brand=${brand}`);
      const data = await res.json() as { campaigns: Campaign[] };
      setCampaigns(data.campaigns ?? []);
    } catch (e) {
      console.error(e);
    }
    setLoadingCampaigns(false);
  };

  const loadAdSets = async (campaignId: string) => {
    if (!campaignId) return;
    setLoadingAdSets(true);
    try {
      const res = await fetch(`/api/pdp/publish?action=adsets&brand=${brand}`);
      const data = await res.json() as { adSets: AdSet[] };
      setAdSets(data.adSets ?? []);
    } catch (e) {
      console.error(e);
    }
    setLoadingAdSets(false);
  };

  useEffect(() => {
    if (showPublishPanel) loadCampaigns();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPublishPanel]);

  useEffect(() => {
    if (selectedCampaign) loadAdSets(selectedCampaign);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCampaign]);

  const handlePublish = async () => {
    if (!selectedAdSet) return;
    setPublishing(true);
    setPublishError(null);
    setPublishResults([]);

    try {
      const jobs = images.map((img, i) => ({
        jobId: `studio-${i}`,
        imageBase64: img.base64,
        mimeType: img.mimeType,
        wineName: `Studio Ad ${i + 1}`,
        headline,
        primary_text: primaryText,
        description: "",
        saleUrl: "https://winespies.com",
      }));

      const res = await fetch("/api/pdp/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand, adSetId: selectedAdSet, jobs }),
      });
      const data = await res.json() as { results: { jobId: string; success: boolean; adId?: string; error?: string }[] };
      const results: PublishResult[] = (data.results ?? []).map((r, i) => ({
        imageIndex: i,
        success: r.success,
        adId: r.adId,
        error: r.error,
      }));
      setPublishResults(results);
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : "Publish failed");
    }
    setPublishing(false);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Download & Publish</h2>
          <p className="text-xs text-muted mt-0.5">{images.length} image{images.length > 1 ? "s" : ""} generated</p>
        </div>
        <button type="button" onClick={onBack} className="text-sm text-muted hover:text-foreground">
          ← Back
        </button>
      </div>

      {/* Images with download buttons */}
      <div className="flex flex-col gap-3">
        {images.map((img, i) => (
          <div key={i} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-surface">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:${img.mimeType};base64,${img.base64}`}
              alt={`Ad ${i + 1}`}
              className="w-20 h-20 rounded-lg object-cover border border-border shrink-0"
            />
            <div className="flex-1 flex flex-col gap-2">
              <p className="text-sm font-medium">Ad {i + 1}</p>
              <button
                type="button"
                onClick={() => download(img, i)}
                className="self-start px-3 py-1.5 text-xs border border-border rounded-lg hover:border-accent transition-colors"
              >
                Download
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Publish section */}
      {!showPublishPanel ? (
        <button
          type="button"
          onClick={() => setShowPublishPanel(true)}
          className="w-full py-2.5 text-sm border border-border rounded-lg hover:border-accent transition-colors"
        >
          Publish to Meta
        </button>
      ) : (
        <div className="flex flex-col gap-3 border border-border rounded-xl p-4">
          <p className="text-sm font-semibold">Publish to Meta</p>

          {loadingCampaigns ? (
            <p className="text-xs text-muted">Loading campaigns...</p>
          ) : (
            <div>
              <label className="text-xs text-muted block mb-1">Campaign</label>
              <select
                value={selectedCampaign}
                onChange={(e) => { setSelectedCampaign(e.target.value); setSelectedAdSet(""); }}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-surface focus:outline-none focus:border-accent"
              >
                <option value="">Select campaign...</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {selectedCampaign && (
            loadingAdSets ? (
              <p className="text-xs text-muted">Loading ad sets...</p>
            ) : (
              <div>
                <label className="text-xs text-muted block mb-1">Ad Set</label>
                <select
                  value={selectedAdSet}
                  onChange={(e) => setSelectedAdSet(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-surface focus:outline-none focus:border-accent"
                >
                  <option value="">Select ad set...</option>
                  {adSets.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            )
          )}

          {publishError && <p className="text-xs text-danger">{publishError}</p>}

          {publishResults.length > 0 && (
            <div className="flex flex-col gap-1">
              {publishResults.map((r) => (
                <p key={r.imageIndex} className={`text-xs ${r.success ? "text-success" : "text-danger"}`}>
                  Ad {r.imageIndex + 1}: {r.success ? `Published (${r.adId})` : r.error}
                </p>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={handlePublish}
            disabled={!selectedAdSet || publishing}
            className="w-full py-2.5 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-40 transition-colors font-medium"
          >
            {publishing ? "Publishing..." : `Publish ${images.length} ad${images.length > 1 ? "s" : ""}`}
          </button>
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -20
```

- [ ] **Step 3: Commit**

```bash
git add app/creative/ad-builder/studio/components/DownloadPublishPanel.tsx
git commit -m "feat: add DownloadPublishPanel — download and Meta publish for studio ads"
```

---

## Task 11: Replace Studio Page with 4-Step Wizard

**Files:**
- Modify: `app/creative/ad-builder/studio/page.tsx`

Orchestrates all 4 steps with a step indicator and shared state.

- [ ] **Step 1: Rewrite the page**

```typescript
// app/creative/ad-builder/studio/page.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import StylePicker from "./components/StylePicker";
import ContentConfigurator, { type ContentTokens } from "./components/ContentConfigurator";
import GeneratePanel, { type GeneratedImage } from "./components/GeneratePanel";
import DownloadPublishPanel from "./components/DownloadPublishPanel";
import type { StudioStyle } from "./hooks/useStudioStyles";

const BRAND = "winespies";

const STEPS = [
  { n: 1, label: "Pick Style" },
  { n: 2, label: "Configure" },
  { n: 3, label: "Generate" },
  { n: 4, label: "Publish" },
] as const;

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 shrink-0">
      {STEPS.map((step, i) => (
        <div key={step.n} className="flex items-center">
          <div className="flex items-center gap-1.5">
            <div
              className={`w-6 h-6 rounded-full text-xs font-semibold flex items-center justify-center ${
                current === step.n
                  ? "bg-accent text-white"
                  : current > step.n
                  ? "bg-accent/20 text-accent"
                  : "bg-border text-muted"
              }`}
            >
              {current > step.n ? (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : step.n}
            </div>
            <span className={`text-xs hidden sm:block ${current === step.n ? "text-foreground font-medium" : "text-muted"}`}>
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`w-8 h-px mx-2 ${current > step.n ? "bg-accent/40" : "bg-border"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function CreativeStudio() {
  const [step, setStep] = useState(1);
  const [selectedStyle, setSelectedStyle] = useState<StudioStyle | null>(null);
  const [tokens, setTokens] = useState<ContentTokens | null>(null);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);

  const handleStyleSelect = (style: StudioStyle) => {
    setSelectedStyle(style);
  };

  const handleStyleNext = () => {
    if (selectedStyle) setStep(2);
  };

  const handleContentComplete = (t: ContentTokens) => {
    setTokens(t);
    setStep(3);
  };

  const handleGenerated = (images: GeneratedImage[]) => {
    setGeneratedImages(images);
    if (images.length > 0) setStep(4);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/creative/ad-builder"
            className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Ad Builder
          </Link>
          <span className="text-border">|</span>
          <h1 className="text-sm font-semibold">Creative Ad Studio</h1>
        </div>
        <StepIndicator current={step} />
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6">

          {/* Step 1: Pick Style */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-base font-semibold">Pick a Style</h2>
                <p className="text-xs text-muted mt-0.5">Choose a reference ad template to base your ad on.</p>
              </div>
              <StylePicker
                selected={selectedStyle}
                onSelect={handleStyleSelect}
                brand={BRAND}
              />
              {selectedStyle && (
                <div className="sticky bottom-4">
                  <button
                    type="button"
                    onClick={handleStyleNext}
                    className="w-full py-3 text-sm bg-accent text-white rounded-xl hover:bg-accent/90 transition-colors font-medium shadow-lg"
                  >
                    Continue with {selectedStyle.label} →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Configure Content */}
          {step === 2 && selectedStyle && (
            <ContentConfigurator
              style={selectedStyle}
              brand={BRAND}
              onComplete={handleContentComplete}
              onBack={() => setStep(1)}
            />
          )}

          {/* Step 3: Generate */}
          {step === 3 && selectedStyle && tokens && (
            <GeneratePanel
              style={selectedStyle}
              tokens={tokens}
              onBack={() => setStep(2)}
              onGenerated={handleGenerated}
            />
          )}

          {/* Step 4: Download / Publish */}
          {step === 4 && generatedImages.length > 0 && tokens && (
            <DownloadPublishPanel
              images={generatedImages}
              brand={BRAND}
              headline={tokens.headline}
              primaryText={tokens.primaryText}
              onBack={() => setStep(3)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 3: Smoke test in dev**

```bash
npm run dev
```

Navigate to `http://localhost:3000/creative/ad-builder/studio`. Verify:
- Step indicator shows "Pick Style" active
- If 14 `.webp` files exist without `.md` files, the amber ingest banner appears
- Clicking "Ingest all" triggers batch processing (takes 1-2 min for 14 images)
- After ingest, style cards appear in the grid with angle badges
- Clicking a card selects it; "Continue with X" button appears at bottom
- Step 2 adapts to the angle (USP picker, review picker, or auto-drafted copy)
- Step 3 shows Generate button; clicking calls Gemini (20-40s)
- Step 4 shows Download and Publish to Meta options

- [ ] **Step 4: Commit**

```bash
git add app/creative/ad-builder/studio/page.tsx
git commit -m "feat: replace studio stub with 4-step Creative Ad Studio wizard"
```

---

## Self-Review

**Spec coverage check:**

| Spec requirement | Task |
|---|---|
| `POST /api/ad-reference/generate-full` — Claude Vision → structured JSON | Task 2 |
| Brand modifier prepended to generationPrompt | Task 2 (buildSystemPrompt) |
| Token rules ({{headline}}, {{primaryText}}, etc.) | Task 2 (TOKEN RULES section) |
| `POST /api/ad-reference/batch-ingest` — scan Static folder, ingest | Task 3 |
| GET on batch-ingest — detect unregistered | Task 3 (GET handler) |
| "Ingest unregistered" button in StylePicker | Task 7 |
| "Add Template" card with upload form | Task 7 (AddTemplateCard) |
| `POST /api/studio/generate-copy` | Task 4 |
| `POST /api/studio/generate` with token resolution | Task 5 |
| Step 1 StylePicker — grid, angle badges, filter excludes pdp | Task 7 |
| Step 2 ContentConfigurator — angle-adaptive | Task 8 |
| USP angle — context hub USP dropdown | Task 8 |
| Testimonial angle — reviews picker, 4-5 stars | Task 8 |
| Lifestyle / offer — Claude draft + editable fields | Task 8 |
| Step 3 GeneratePanel — generate + regenerate + back | Task 9 |
| Multiple variations if promptOverrides.numberOfVariations > 1 | Task 5 (generate route) |
| Step 4 DownloadPublishPanel — download + Meta publish | Task 10 |
| Meta publish reuses existing infrastructure | Task 10 (POST /api/pdp/publish) |
| `"usp"` added to AdType | Task 1 |
| Edge: no registered templates — only Add Template card shown | Task 7 (empty state) |
| Edge: unresolved tokens → empty string before Gemini | Task 5 (resolveTokens) |
| Edge: testimonial + no reviews → freeform fallback | Task 8 (fallback message) |

**Placeholder scan:** No TBDs or incomplete sections found.

**Type consistency:** `ContentTokens` is defined in `ContentConfigurator.tsx` and imported in `page.tsx`. `GeneratedImage` is defined in `GeneratePanel.tsx` and imported in `page.tsx` and `DownloadPublishPanel.tsx`. `StudioStyle` is defined in `useStudioStyles.ts` and imported by `StylePicker.tsx`, `ContentConfigurator.tsx`, `GeneratePanel.tsx`, and `page.tsx`.
