import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { generateAdImage } from "@/lib/gemini";
import { readStyles, getAdBuilderDir } from "@/lib/ad-builder-storage";
import { STYLES_SUBDIR } from "@/lib/ad-builder";
import type { WineDetails } from "@/lib/ad-builder";

export const maxDuration = 120;

async function fetchImageBase64(url: string): Promise<{ base64: string; mimeType: string }> {
  const res = await fetch(url);
  if (!res.ok) throw new Error(`Failed to fetch bottle image (${res.status})`);
  const buf = Buffer.from(await res.arrayBuffer());
  const ct = res.headers.get("content-type") ?? "image/jpeg";
  return { base64: buf.toString("base64"), mimeType: ct.split(";")[0].trim() };
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as {
      brand?: string;
      styleId: string;
      wineData: {
        headline: string;
        score?: string;
        pullQuote?: string;
        salePrice: string;
        retailPrice: string;
        ctaText?: string;
        bottleImageUrl: string;
      };
    };

    const brand = body.brand ?? "winespies";
    const { styleId, wineData } = body;

    if (!styleId || !wineData?.bottleImageUrl) {
      return NextResponse.json(
        { error: "styleId and wineData.bottleImageUrl are required" },
        { status: 400 }
      );
    }

    // Load style reference image from ad-builder styles directory
    const { styles } = readStyles(brand);
    const style = styles.find((s) => s.id === styleId);
    if (!style) {
      return NextResponse.json({ error: `Style not found: ${styleId}` }, { status: 404 });
    }

    const stylePath = path.join(getAdBuilderDir(brand), STYLES_SUBDIR, style.filename);
    if (!fs.existsSync(stylePath)) {
      return NextResponse.json({ error: "Style image file missing on disk" }, { status: 404 });
    }

    const styleBase64 = fs.readFileSync(stylePath).toString("base64");
    const styleExt = path.extname(style.filename).toLowerCase();
    const styleMime =
      styleExt === ".jpg" || styleExt === ".jpeg"
        ? "image/jpeg"
        : styleExt === ".webp"
        ? "image/webp"
        : "image/png";

    // Fetch the wine's bottle image from the CDN URL
    const bottle = await fetchImageBase64(wineData.bottleImageUrl);

    const wineDetails: WineDetails = {
      headline: wineData.headline,
      score: wineData.score || undefined,
      pullQuote: wineData.pullQuote || undefined,
      retailPrice: wineData.retailPrice,
      salePrice: wineData.salePrice,
      ctaText: wineData.ctaText ?? "Shop This Deal →",
    };

    const result = await generateAdImage({
      referenceImageBase64: styleBase64,
      referenceImageMimeType: styleMime,
      bottleImages: [{ base64: bottle.base64, mimeType: bottle.mimeType }],
      wineDetails,
      styleName: style.name,
      strictTemplateMode: true,
    });

    return NextResponse.json({ imageBase64: result.imageBase64, mimeType: result.mimeType });
  } catch (err) {
    console.error("[pdp/generate]", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Generation failed" },
      { status: 500 }
    );
  }
}
