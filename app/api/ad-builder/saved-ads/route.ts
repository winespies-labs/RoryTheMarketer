import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { ensureBrandDataDir } from "@/lib/brands";

type SavedAd = {
  id: string;
  wineName: string;
  saleId: number;
  templateId: string;
  headline: string;
  primaryText: string;
  description: string;
  destinationUrl: string;
  imageBase64: string;
  imageMimeType: string;
  savedAt: string;
};

function getSavedAdsPath(brandId: string): string {
  const dir = ensureBrandDataDir(brandId);
  return path.join(dir, "saved-ads.json");
}

function readSavedAds(brandId: string): SavedAd[] {
  const filePath = getSavedAdsPath(brandId);
  if (!fs.existsSync(filePath)) return [];
  try {
    const raw = fs.readFileSync(filePath, "utf8");
    const data = JSON.parse(raw);
    return Array.isArray(data) ? data : [];
  } catch {
    return [];
  }
}

function writeSavedAds(brandId: string, ads: SavedAd[]): void {
  const filePath = getSavedAdsPath(brandId);
  fs.writeFileSync(filePath, JSON.stringify(ads, null, 2), "utf8");
}

export async function GET(req: NextRequest) {
  const brand = req.nextUrl.searchParams.get("brand") || "winespies";
  const ads = readSavedAds(brand);
  return NextResponse.json({ ads });
}

export async function POST(req: NextRequest) {
  const brand = req.nextUrl.searchParams.get("brand") || "winespies";
  try {
    const body = await req.json();
    const incoming: SavedAd[] = Array.isArray(body.ads) ? body.ads : [body];

    const existing = readSavedAds(brand);
    const existingIds = new Set(existing.map((a) => a.id));
    const newAds = incoming.filter((a) => !existingIds.has(a.id));

    const merged = [...newAds, ...existing];
    writeSavedAds(brand, merged);

    return NextResponse.json({ saved: newAds.length, total: merged.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const brand = req.nextUrl.searchParams.get("brand") || "winespies";
  try {
    const body = await req.json();
    const id: string = body.id;
    if (!id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const existing = readSavedAds(brand);
    const filtered = existing.filter((a) => a.id !== id);
    writeSavedAds(brand, filtered);

    return NextResponse.json({ deleted: id, total: filtered.length });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
