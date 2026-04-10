import { NextRequest, NextResponse } from "next/server";
import { getBrand } from "@/lib/brands";
import { getAdSettings, saveAdSettings, type AdSettings } from "@/lib/ad-settings";

export async function GET(req: NextRequest) {
  const brand = new URL(req.url).searchParams.get("brand") ?? "winespies";
  if (!getBrand(brand)) {
    return NextResponse.json({ error: "Unknown brand" }, { status: 400 });
  }
  return NextResponse.json(getAdSettings(brand));
}

export async function POST(req: NextRequest) {
  const brand = new URL(req.url).searchParams.get("brand") ?? "winespies";
  if (!getBrand(brand)) {
    return NextResponse.json({ error: "Unknown brand" }, { status: 400 });
  }
  try {
    const settings = (await req.json()) as AdSettings;
    saveAdSettings(brand, settings);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid settings body" }, { status: 400 });
  }
}
