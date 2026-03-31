import { GoogleGenAI } from "@google/genai";
import type { WineDetails, AspectRatio, CopyVariation } from "@/lib/ad-builder";
import { ASPECT_RATIO_CONFIG } from "@/lib/ad-builder";
import { substitutePromptVariables, type PromptVariableContext } from "@/lib/prompt-variables";

let _genAI: GoogleGenAI | null = null;

function getGenAI(): GoogleGenAI {
  if (!_genAI) {
    _genAI = new GoogleGenAI({ apiKey: process.env.GOOGLE_AI_API_KEY! });
  }
  return _genAI;
}

export interface GenerateAdImageInput {
  referenceImageBase64: string;
  referenceImageMimeType: string;
  /** @deprecated Use bottleImages instead */
  bottleImageBase64?: string;
  /** @deprecated Use bottleImages instead */
  bottleImageMimeType?: string;
  bottleImages?: { base64: string; mimeType: string }[];
  backgroundImageBase64?: string;
  backgroundImageMimeType?: string;
  wineDetails: WineDetails;
  styleName: string;
  imagePromptModifier?: string;
  aspectRatio?: AspectRatio;
  /** Per-template visual layout notes — specific instructions for this template's composition. */
  visualNotes?: string;
  /** Brand asset images (logo, badges, trust marks) to include exactly as provided. */
  brandAssets?: { base64: string; mimeType: string; label: string }[];
  /**
   * When true (reference-template ads), the prompt insists on replacing all reference copy
   * and on uniform price-pill styling so outputs stay consistent across runs.
   */
  strictTemplateMode?: boolean;
  /** For `{{...}}` in visualNotes / imagePromptModifier (wine fields, {{wineName}}, {{copy.*}}). */
  wineName?: string;
  saleId?: number;
  brandId?: string;
  copyVariation?: CopyVariation;
}

interface GenerateAdImageResult {
  imageBase64: string;
  mimeType: string;
}

/** Merge Claude copy + PDP fields for Gemini so the image model always gets on-ad body text (not just reference pixels). */
export function wineDetailsForReferenceTemplate(
  wineDetails: Partial<WineDetails>,
  copy: { primaryText: string; headline: string; description: string },
  headlineFallback: string,
): WineDetails {
  const body =
    wineDetails.pullQuote?.trim() ||
    copy.primaryText?.trim() ||
    copy.description?.trim() ||
    "";
  const headline =
    copy.headline?.trim() || wineDetails.headline?.trim() || headlineFallback;
  return {
    ...(wineDetails as WineDetails),
    headline,
    ...(body ? { pullQuote: body } : {}),
  };
}

export function buildPrompt(
  details: WineDetails,
  styleName: string,
  options?: {
    imagePromptModifier?: string;
    aspectRatio?: AspectRatio;
    visualNotes?: string;
    strictTemplateMode?: boolean;
  },
): string {
  const ar = options?.aspectRatio ?? "1:1";
  const dims = ASPECT_RATIO_CONFIG[ar];
  const lines: string[] = [];

  if (options?.imagePromptModifier) {
    lines.push(
      `BRAND VISUAL IDENTITY:`,
      options.imagePromptModifier,
      ``,
    );
  }

  lines.push(
    `Create a professional ${dims.width}x${dims.height} pixel wine offer advertisement.`,
    ``,
    `STYLE REFERENCE: Match the layout, typography style, color scheme, and overall aesthetic of the provided reference image labeled "${styleName}". Use it as the design template.`,
  );

  if (options?.visualNotes) {
    lines.push(
      ``,
      `TEMPLATE LAYOUT RULES (follow these exactly):`,
      options.visualNotes,
    );
  }

  lines.push(
    ``,
    `PRODUCT IMAGE: Use the provided bottle image as the hero product shot. Place it prominently in the composition. Keep the bottle image faithful to the original — do not alter the label, shape, or colors.`,
    ``,
    `TEXT ELEMENTS TO INCLUDE:`,
    `- Headline: "${details.headline}"`,
  );

  if (details.score) {
    lines.push(`- Score/Rating: "${details.score}"`);
  }
  if (details.pullQuote) {
    const pullLabel = options?.strictTemplateMode
      ? `Body / supporting paragraph (replace every line of body copy from the reference in this area; render verbatim — do not keep reference wording)`
      : `Pull Quote`;
    lines.push(`- ${pullLabel}: "${details.pullQuote}"`);
  }
  if (details.retailPrice) {
    lines.push(
      `- Original/Retail Price: "${details.retailPrice}" (show as crossed out or secondary)`
    );
  }
  if (details.salePrice) {
    lines.push(
      `- Sale Price: "${details.salePrice}" (make this prominent and eye-catching)`
    );
  }
  if (details.promoCode) {
    lines.push(`- Promo Code: "${details.promoCode}"`);
  }
  if (details.ctaText) {
    lines.push(`- Call to Action: "${details.ctaText}"`);
  }

  lines.push(
    ``,
    `REQUIREMENTS:`,
    `- Exactly ${dims.width}x${dims.height} pixels`,
    `- All text must be clearly legible and spelled correctly`,
    `- Professional, polished design suitable for social media advertising`,
    `- ONLY include the exact text elements listed above — do not generate, add, or invent any additional copy, paragraphs, or text`,
    `- Render all text VERBATIM as provided — do not rephrase, truncate, or abbreviate`,
    `- If a pull quote is provided, display it exactly as written — do not shorten it`,
    `- Text should be rendered crisp and clean, not blurry`,
    `- If brand asset images are provided (logo, badges, trust marks), reproduce them EXACTLY as provided — do not replace logos with text or recreate badge designs from scratch. Place them in the positions shown in the reference image.`,
  );

  if (options?.strictTemplateMode) {
    lines.push(
      ``,
      `TEMPLATE MODE — COPY AND PRICE CONTROLS (critical):`,
      `- The reference image is for LAYOUT, COLOR, and TYPOGRAPHY STYLE only. Do NOT copy its words. If any phrase from the reference (sample winemaker names, quotes, prices, or paragraphs) appears in the output but is NOT listed under TEXT ELEMENTS above, the image is wrong — remove it and use only the provided strings.`,
      `- Two price pills side by side: make them the SAME width, SAME height, SAME corner radius, and SAME vertical alignment. Left pill: white background (#FFFFFF) with black text (#000000) for the retail/original price. Right pill: solid sale red — match the reference template's sale pill red if you can, otherwise use #C41E3A — with white text for the sale price. Use the SAME font size and weight for both price numbers. Do not let one pill be taller, wider, or a different shade than the other from run to run.`,
    );
  }

  if (details.additionalNotes) {
    lines.push(``, `ADDITIONAL INSTRUCTIONS: ${details.additionalNotes}`);
  }

  return lines.join("\n");
}

export async function generateAdImage(
  input: GenerateAdImageInput
): Promise<GenerateAdImageResult> {
  const varCtx: PromptVariableContext = {
    wineDetails: input.wineDetails,
    wineName: input.wineName,
    saleId: input.saleId,
    brandId: input.brandId,
    copy: input.copyVariation,
  };
  const visualNotes = substitutePromptVariables(input.visualNotes, varCtx);
  const imagePromptModifier = substitutePromptVariables(
    input.imagePromptModifier,
    varCtx,
  );

  const prompt = buildPrompt(input.wineDetails, input.styleName, {
    imagePromptModifier,
    aspectRatio: input.aspectRatio,
    visualNotes,
    strictTemplateMode: input.strictTemplateMode,
  });

  const contents = [
    {
      text: prompt,
    },
    {
      text: `Reference style image ("${input.styleName}"):`,
    },
    {
      inlineData: {
        data: input.referenceImageBase64,
        mimeType: input.referenceImageMimeType,
      },
    },
  ];

  // Add bottle images (support both old single and new multi format)
  const bottles = input.bottleImages?.length
    ? input.bottleImages
    : input.bottleImageBase64 && input.bottleImageMimeType
      ? [{ base64: input.bottleImageBase64, mimeType: input.bottleImageMimeType }]
      : [];

  if (bottles.length === 1) {
    contents.push(
      { text: "Product bottle image:" },
      { inlineData: { data: bottles[0].base64, mimeType: bottles[0].mimeType } },
    );
  } else if (bottles.length > 1) {
    contents.push({ text: `Product images (${bottles.length} bottles — include ALL in the ad):` });
    for (const b of bottles) {
      contents.push({ inlineData: { data: b.base64, mimeType: b.mimeType } });
    }
  }

  // Add brand asset images (logo, badges, trust marks)
  if (input.brandAssets?.length) {
    contents.push({ text: "Brand assets (use these exact images — do not recreate as text):" });
    for (const asset of input.brandAssets) {
      contents.push({ text: `${asset.label}:` });
      contents.push({ inlineData: { data: asset.base64, mimeType: asset.mimeType } });
    }
  }

  if (input.backgroundImageBase64 && input.backgroundImageMimeType) {
    contents.push(
      {
        text: "Background image (use as the background/scene for the ad):",
      },
      {
        inlineData: {
          data: input.backgroundImageBase64,
          mimeType: input.backgroundImageMimeType,
        },
      }
    );
  }

  const response = await getGenAI().models.generateContent({
    model: "gemini-3-pro-image-preview",
    contents: [{ role: "user", parts: contents }],
    config: {
      responseModalities: ["IMAGE", "TEXT"],
    },
  });

  const parts = response.candidates?.[0]?.content?.parts;
  if (!parts) {
    throw new Error("No response from Gemini");
  }

  for (const part of parts) {
    if (part.inlineData) {
      return {
        imageBase64: part.inlineData.data!,
        mimeType: part.inlineData.mimeType || "image/png",
      };
    }
  }

  throw new Error("Gemini did not return an image");
}
