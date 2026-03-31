import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { getBrand } from "@/lib/brands";
import type { WineDetails, GeneratedAd, AspectRatio } from "@/lib/ad-builder";
import { STYLES_SUBDIR, UPLOADS_SUBDIR, GENERATED_SUBDIR } from "@/lib/ad-builder";
import {
  readStyles,
  addGeneration,
  saveUploadedFile,
  getAdBuilderDir,
  ensureSubdir,
} from "@/lib/ad-builder-storage";
import { generateAdImage } from "@/lib/gemini";

export const maxDuration = 120;

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

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const brandId = formData.get("brand") as string;

  if (!brandId || !getBrand(brandId)) {
    return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
  }

  const bottleImage = formData.get("bottleImage") as File | null;
  const backgroundImage = formData.get("backgroundImage") as File | null;
  const headline = formData.get("headline") as string;
  const styleIdsRaw = formData.get("styleIds") as string;

  if (!bottleImage || !headline || !styleIdsRaw) {
    return NextResponse.json(
      { error: "bottleImage, headline, and styleIds are required" },
      { status: 400 }
    );
  }

  let styleIds: string[];
  try {
    styleIds = JSON.parse(styleIdsRaw);
    if (!Array.isArray(styleIds) || styleIds.length === 0) throw new Error();
  } catch {
    return NextResponse.json(
      { error: "styleIds must be a non-empty JSON array" },
      { status: 400 }
    );
  }

  const aspectRatio = (formData.get("aspectRatio") as AspectRatio) || undefined;
  const imagePromptModifier = (formData.get("imagePromptModifier") as string) || undefined;

  // Build wine details from form fields
  const wineDetails: WineDetails = { headline };
  const optionalFields = [
    "score",
    "pullQuote",
    "retailPrice",
    "salePrice",
    "promoCode",
    "ctaText",
    "additionalNotes",
  ] as const;
  for (const field of optionalFields) {
    const val = formData.get(field) as string | null;
    if (val) wineDetails[field] = val;
  }

  // Save bottle image
  const bottleBuffer = Buffer.from(await bottleImage.arrayBuffer());
  const bottleFilename = saveUploadedFile(
    brandId,
    UPLOADS_SUBDIR,
    bottleBuffer,
    bottleImage.name
  );
  const bottleBase64 = bottleBuffer.toString("base64");
  const bottleMimeType = getMimeType(bottleImage.name);

  // Save background image if provided
  let bgBase64: string | undefined;
  let bgMimeType: string | undefined;
  if (backgroundImage && backgroundImage.size > 0) {
    const bgBuffer = Buffer.from(await backgroundImage.arrayBuffer());
    saveUploadedFile(brandId, UPLOADS_SUBDIR, bgBuffer, backgroundImage.name);
    bgBase64 = bgBuffer.toString("base64");
    bgMimeType = getMimeType(backgroundImage.name);
  }

  // Resolve styles
  const allStyles = readStyles(brandId);
  const selectedStyles = allStyles.styles.filter((s) =>
    styleIds.includes(s.id)
  );

  if (selectedStyles.length === 0) {
    return NextResponse.json(
      { error: "No valid styles found for given IDs" },
      { status: 400 }
    );
  }

  // Generate ads for each style in parallel
  const results = await Promise.allSettled(
    selectedStyles.map(async (style) => {
      // Read style image
      const stylePath = path.join(
        getAdBuilderDir(brandId),
        STYLES_SUBDIR,
        style.filename
      );
      const styleBuffer = fs.readFileSync(stylePath);
      const styleBase64 = styleBuffer.toString("base64");
      const styleMimeType = getMimeType(style.filename);

      const result = await generateAdImage({
        referenceImageBase64: styleBase64,
        referenceImageMimeType: styleMimeType,
        bottleImageBase64: bottleBase64,
        bottleImageMimeType: bottleMimeType,
        backgroundImageBase64: bgBase64,
        backgroundImageMimeType: bgMimeType,
        wineDetails,
        styleName: style.name,
        imagePromptModifier,
        aspectRatio,
      });

      // Save generated image
      const genDir = ensureSubdir(brandId, GENERATED_SUBDIR);
      const ext =
        result.mimeType === "image/png"
          ? ".png"
          : result.mimeType === "image/webp"
            ? ".webp"
            : ".jpg";
      const genFilename = `${nanoid()}${ext}`;
      fs.writeFileSync(
        path.join(genDir, genFilename),
        Buffer.from(result.imageBase64, "base64")
      );

      const gen: GeneratedAd = {
        id: nanoid(),
        styleId: style.id,
        styleName: style.name,
        filename: genFilename,
        wineDetails,
        createdAt: new Date().toISOString(),
      };

      addGeneration(brandId, gen);
      return gen;
    })
  );

  const generations: GeneratedAd[] = [];
  const failures: { styleId: string; error: string }[] = [];

  for (let i = 0; i < results.length; i++) {
    const result = results[i];
    if (result.status === "fulfilled") {
      generations.push(result.value);
    } else {
      failures.push({
        styleId: selectedStyles[i].id,
        error:
          result.reason instanceof Error
            ? result.reason.message
            : String(result.reason),
      });
    }
  }

  // Clean up bottle upload file (optional, keeping for reference)
  // The uploads dir is intentionally kept for debugging

  return NextResponse.json({ generations, failures, bottleFilename });
}
