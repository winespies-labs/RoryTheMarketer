import { NextRequest, NextResponse } from "next/server";
import { getBrand } from "@/lib/brands";
import {
  uploadAdImage,
  createAdCreative,
  createAd,
} from "@/lib/meta-publish";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  let body: {
    brand?: string;
    adsetId?: string;
    adName?: string;
    imageBase64?: string;
    primaryText?: string;
    headline?: string;
    description?: string;
    destinationUrl?: string;
    ctaType?: string;
    status?: string;
  };

  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const brandId = body.brand ?? "winespies";
  if (!getBrand(brandId)) {
    return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
  }

  const { adsetId, adName, imageBase64, primaryText, headline, description, destinationUrl, ctaType, status } = body;

  if (!adsetId) return NextResponse.json({ error: "adsetId is required" }, { status: 400 });
  if (!imageBase64) return NextResponse.json({ error: "imageBase64 is required" }, { status: 400 });
  if (!headline) return NextResponse.json({ error: "headline is required" }, { status: 400 });

  const name = adName || `Workshop Ad — ${new Date().toISOString().slice(0, 10)}`;

  try {
    // Step 1: Upload image
    const { hash } = await uploadAdImage(brandId, imageBase64);

    // Step 2: Create ad creative
    const { id: creativeId } = await createAdCreative(brandId, {
      name,
      imageHash: hash,
      primaryText: primaryText ?? "",
      headline,
      description: description ?? "",
      link: destinationUrl ?? "",
      ctaType: ctaType ?? "SHOP_NOW",
    });

    // Step 3: Create ad in the chosen ad set
    const { id: metaAdId } = await createAd(brandId, {
      name,
      adsetId,
      creativeId,
      status: status ?? "PAUSED",
    });

    return NextResponse.json({ ok: true, metaAdId, creativeId });
  } catch (err) {
    const step = (err as Error).message?.includes("upload")
      ? "upload"
      : (err as Error).message?.includes("creative")
        ? "creative"
        : "ad";
    return NextResponse.json(
      { ok: false, error: err instanceof Error ? err.message : "Publish failed", step },
      { status: 500 },
    );
  }
}
