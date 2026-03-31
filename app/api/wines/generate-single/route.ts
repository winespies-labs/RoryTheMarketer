import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import Anthropic from "@anthropic-ai/sdk";
import { getBrand } from "@/lib/brands";
import { getContextBundle, formatContextForPrompt } from "@/lib/context-bundle";
import { buildMetaStaticNanoBananaPrompt, buildPromptForType } from "@/lib/ad-prompt-templates";
import {
  getReferenceAdById,
  getReferenceAdStyleImagePath,
} from "@/lib/reference-ads";
import { generateAdImage, wineDetailsForReferenceTemplate } from "@/lib/gemini";
import { readBrandAssets, getAssetsDir } from "@/lib/brand-assets-storage";
import type { AspectRatio, AdType } from "@/lib/ad-builder";

export const maxDuration = 120;

const anthropic = new Anthropic();

function getMimeType(filename: string): string {
  const ext = path.extname(filename).toLowerCase();
  const map: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
  };
  return map[ext] || "image/png";
}

/** Extract JSON array from model output; strip markdown code blocks if present. */
function extractJsonArray(text: string): unknown {
  let raw = text.trim();
  const codeBlock = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) raw = codeBlock[1].trim();
  const arrayStart = raw.indexOf("[");
  if (arrayStart !== -1) {
    const arrayEnd = raw.lastIndexOf("]");
    if (arrayEnd > arrayStart) raw = raw.slice(arrayStart, arrayEnd + 1);
  }
  return JSON.parse(raw);
}

async function fetchImageAsBase64(
  url: string,
): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch image: ${res.status} ${url}`);
  const buffer = Buffer.from(await res.arrayBuffer());
  const contentType = res.headers.get("content-type") || "image/png";
  return { base64: buffer.toString("base64"), mimeType: contentType };
}

type RequestBody = {
  brand?: string;
  mode?: "basic" | "templated";
  // Wine info
  wineDetails: {
    headline?: string;
    score?: string;
    pullQuote?: string;
    retailPrice?: string;
    salePrice?: string;
    promoCode?: string;
    ctaText?: string;
    additionalNotes?: string;
    productName?: string;
  };
  bottleImageUrl?: string;
  saleId?: number;
  wineName: string;
  // Templated mode options
  referenceId?: string;
  aspectRatio?: AspectRatio;
  imagePromptModifier?: string;
  adType?: AdType;
};

export async function POST(req: NextRequest) {
  let body: RequestBody;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const brandId = body.brand ?? "winespies";
  if (!getBrand(brandId)) {
    return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
  }

  const mode = body.mode ?? "basic";
  const { wineDetails, bottleImageUrl, saleId, wineName } = body;
  const adType = body.adType;

  // bottleImageUrl is optional for lifestyle ads
  if (!wineDetails || (!bottleImageUrl && adType !== "lifestyle")) {
    return NextResponse.json(
      { error: "wineDetails and bottleImageUrl are required" },
      { status: 400 },
    );
  }

  try {
    // --- Step 1: Generate ad copy via Claude ---
    const bundle = getContextBundle(brandId);
    const contextText = formatContextForPrompt(bundle);

    let copyVariation: { primaryText: string; headline: string; description: string };

    if (mode === "templated" && body.referenceId) {
      // Templated mode: use reference ad prompt builder
      const refAd = getReferenceAdById(body.referenceId);
      if (!refAd) {
        return NextResponse.json(
          { error: `Reference ad not found: ${body.referenceId}` },
          { status: 404 },
        );
      }

      const promptOptions = {
        brandName: brandId,
        contextText,
        referenceAd: refAd,
        wineDetailsOverride: wineDetails,
        wineName,
        saleId,
      };
      const builtPrompt = adType && adType !== "pdp"
        ? buildPromptForType(adType, promptOptions)
        : buildMetaStaticNanoBananaPrompt(promptOptions);

      // Override to produce exactly 1 variation
      const userPrompt = builtPrompt.user
        .replace(/Write \d+ high-performing/, "Write 1 high-performing")
        .replace(/exactly \d+ objects/, "exactly 1 object");

      const msg = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 1500,
        system: builtPrompt.system,
        messages: [{ role: "user", content: userPrompt }],
      });

      const text = msg.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();

      const parsed = extractJsonArray(text) as { primaryText: string; headline: string; description: string }[];
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error("Copy generation returned no variations");
      }
      copyVariation = parsed[0];
    } else {
      // Basic mode: simple copy generation prompt
      const system = [
        "You are an expert direct-response copywriter focused on paid Meta ads for wine.",
        "Write conversion-focused ad copy that respects brand guidelines.",
        "",
        contextText,
      ].join("\n");

      const user = [
        `Write 1 Meta ad copy variation for this wine:`,
        ``,
        `Wine: ${wineName}`,
        wineDetails.headline ? `Headline: ${wineDetails.headline}` : "",
        wineDetails.retailPrice ? `Retail Price: ${wineDetails.retailPrice}` : "",
        wineDetails.salePrice ? `Sale Price: ${wineDetails.salePrice}` : "",
        wineDetails.pullQuote ? `Tasting Notes: ${wineDetails.pullQuote}` : "",
        wineDetails.additionalNotes ? `Details: ${wineDetails.additionalNotes}` : "",
        ``,
        `Destination URL: https://winespies.com/sales/${saleId}`,
        ``,
        `RULES:`,
        `- Lead with the strongest value proposition (price drop, score, etc.)`,
        `- Keep primary text under 125 characters for mobile visibility`,
        `- Headline should be punchy and under 40 characters`,
        `- Description should reinforce urgency or value`,
        `- CTA: Shop Now`,
        ``,
        `OUTPUT FORMAT:`,
        `Reply with ONLY a raw JSON array of exactly 1 object. No markdown, no code fences.`,
        `Object keys: "primaryText", "headline", "description".`,
      ]
        .filter(Boolean)
        .join("\n");

      const msg = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 1000,
        system,
        messages: [{ role: "user", content: user }],
      });

      const text = msg.content
        .filter((b): b is Anthropic.TextBlock => b.type === "text")
        .map((b) => b.text)
        .join("")
        .trim();

      const parsed = extractJsonArray(text) as { primaryText: string; headline: string; description: string }[];
      if (!Array.isArray(parsed) || parsed.length === 0) {
        throw new Error("Copy generation returned no variations");
      }
      copyVariation = parsed[0];
    }

    // --- Step 2: Image ---
    let imageBase64: string;
    let imageMimeType: string;

    if (mode === "basic") {
      // Basic mode: just use the bottle image as-is
      const fetched = await fetchImageAsBase64(bottleImageUrl!);
      imageBase64 = fetched.base64;
      imageMimeType = fetched.mimeType;
    } else {
      // Templated mode: generate styled ad image via Gemini
      if (!body.referenceId) {
        return NextResponse.json(
          { error: "referenceId is required for templated mode" },
          { status: 400 },
        );
      }

      const styleImagePath = getReferenceAdStyleImagePath(body.referenceId);
      if (!styleImagePath) {
        return NextResponse.json(
          { error: "Reference ad has no style image" },
          { status: 400 },
        );
      }

      const refAd = getReferenceAdById(body.referenceId)!;
      const styleBuffer = fs.readFileSync(styleImagePath);
      const styleBase64 = styleBuffer.toString("base64");
      const styleMimeType = getMimeType(path.basename(styleImagePath));
      const styleName = refAd.meta.label || body.referenceId;

      // Download bottle image server-side (optional for lifestyle ads)
      const bottleData = bottleImageUrl
        ? await fetchImageAsBase64(bottleImageUrl)
        : null;

      // Load brand assets (logo, badges) to pass as separate high-fidelity inputs
      const assetsData = readBrandAssets(brandId);
      const overlayAssets = assetsData.assets.filter(
        (a) => a.category === "logo" || a.category === "badge"
      );
      const brandAssets = overlayAssets.map((a) => {
        const filePath = path.join(getAssetsDir(brandId), a.filename);
        const buf = fs.readFileSync(filePath);
        return { base64: buf.toString("base64"), mimeType: getMimeType(a.filename), label: a.label };
      });

      const mergedDetails = wineDetailsForReferenceTemplate(
        wineDetails,
        copyVariation,
        wineName,
      );
      const layoutNotes =
        refAd.visualNotes?.trim() || refAd.adDescription?.trim() || undefined;
      const result = await generateAdImage({
        referenceImageBase64: styleBase64,
        referenceImageMimeType: styleMimeType,
        bottleImages: bottleData ? [{ base64: bottleData.base64, mimeType: bottleData.mimeType }] : [],
        wineDetails: mergedDetails,
        styleName,
        imagePromptModifier: body.imagePromptModifier,
        aspectRatio: body.aspectRatio,
        visualNotes: layoutNotes,
        brandAssets,
        strictTemplateMode: true,
        wineName,
        saleId,
        brandId: brandId,
        copyVariation,
      });

      imageBase64 = result.imageBase64;
      imageMimeType = result.mimeType;
    }

    return NextResponse.json({
      ok: true,
      wineName,
      saleId,
      mode,
      copyVariation,
      imageBase64,
      imageMimeType,
      destinationUrl: saleId ? `https://winespies.com/sales/${saleId}` : "https://winespies.com",
      adType: adType ?? "pdp",
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
