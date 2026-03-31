import { NextRequest, NextResponse } from "next/server";
import { getBrand } from "@/lib/brands";
import {
  uploadAdImage,
  createAdCreative,
  createAd,
} from "@/lib/meta-publish";

export const maxDuration = 120;

type AdInput = {
  id: string;
  wineName: string;
  saleId: number;
  imageBase64: string;
  copyVariation: {
    primaryText: string;
    headline: string;
    description: string;
  };
  destinationUrl: string;
};

type PublishResult = {
  adId: string;
  wineName: string;
  status: "success" | "error";
  metaAdId?: string;
  error?: string;
};

export async function POST(req: NextRequest) {
  let body: { brand?: string; adsetId?: string; ads?: AdInput[] };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const brandId = body.brand ?? "winespies";
  if (!getBrand(brandId)) {
    return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
  }

  const { adsetId, ads } = body;
  if (!adsetId) {
    return NextResponse.json({ error: "adsetId is required" }, { status: 400 });
  }
  if (!ads || !Array.isArray(ads) || ads.length === 0) {
    return NextResponse.json({ error: "ads array is required" }, { status: 400 });
  }

  const results: PublishResult[] = [];

  for (const ad of ads) {
    try {
      // Step 1: Upload image
      const { hash } = await uploadAdImage(brandId, ad.imageBase64);

      // Step 2: Create ad creative
      const adName = `${ad.wineName} — Bulk ${new Date().toISOString().slice(0, 10)}`;
      const { id: creativeId } = await createAdCreative(brandId, {
        name: adName,
        imageHash: hash,
        primaryText: ad.copyVariation.primaryText,
        headline: ad.copyVariation.headline,
        description: ad.copyVariation.description,
        link: ad.destinationUrl,
        ctaType: "SHOP_NOW",
      });

      // Step 3: Create ad in the chosen ad set
      const { id: metaAdId } = await createAd(brandId, {
        name: adName,
        adsetId,
        creativeId,
        status: "ACTIVE",
      });

      results.push({
        adId: ad.id,
        wineName: ad.wineName,
        status: "success",
        metaAdId,
      });
    } catch (err) {
      results.push({
        adId: ad.id,
        wineName: ad.wineName,
        status: "error",
        error: err instanceof Error ? err.message : "Publish failed",
      });
    }
  }

  return NextResponse.json({ results });
}
