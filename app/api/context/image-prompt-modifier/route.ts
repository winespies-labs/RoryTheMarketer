import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getBrand, getBrandContextDir } from "@/lib/brands";

function getModifierPath(brandId: string): string {
  return path.join(getBrandContextDir(brandId), "image-prompt-modifier.md");
}

export async function GET(req: NextRequest) {
  const brandId = new URL(req.url).searchParams.get("brand");
  if (!brandId || !getBrand(brandId)) {
    return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
  }

  const fp = getModifierPath(brandId);
  const content = fs.existsSync(fp) ? fs.readFileSync(fp, "utf-8").trim() : "";
  return NextResponse.json({ content });
}

export async function POST(req: NextRequest) {
  let body: { brand?: string; content?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const brandId = body.brand;
  if (!brandId || !getBrand(brandId)) {
    return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
  }

  const fp = getModifierPath(brandId);
  fs.writeFileSync(fp, body.content ?? "", "utf-8");
  return NextResponse.json({ ok: true });
}
