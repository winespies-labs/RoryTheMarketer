import { NextRequest, NextResponse } from "next/server";
import { getBrand } from "@/lib/brands";
import { getAdSettings, saveAdSettings, type AdSettings } from "@/lib/ad-settings";

export async function GET(req: NextRequest) {
  const brand = req.nextUrl.searchParams.get("brand") ?? "winespies";
  if (!getBrand(brand)) {
    return NextResponse.json({ error: "Unknown brand" }, { status: 400 });
  }
  return NextResponse.json(getAdSettings(brand));
}

export async function POST(req: NextRequest) {
  const brand = req.nextUrl.searchParams.get("brand") ?? "winespies";
  if (!getBrand(brand)) {
    return NextResponse.json({ error: "Unknown brand" }, { status: 400 });
  }
  let settings: AdSettings;
  try {
    settings = (await req.json()) as AdSettings;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }
  try {
    saveAdSettings(brand, settings);
  } catch (err) {
    console.error("[ads/settings] Failed to save settings:", err);
    return NextResponse.json({ error: "Failed to save settings" }, { status: 500 });
  }
  return NextResponse.json({ ok: true });
}
