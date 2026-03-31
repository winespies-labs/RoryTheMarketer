import { NextRequest, NextResponse } from "next/server";
import fs from "fs";
import path from "path";
import { getBrand, getBrandContextDir } from "@/lib/brands";
import { MARKDOWN_SECTIONS } from "@/lib/context-sections";

export async function GET(req: NextRequest) {
  const brand = req.nextUrl.searchParams.get("brand");
  const section = req.nextUrl.searchParams.get("section");

  if (!brand || !section) {
    return NextResponse.json({ error: "brand and section required" }, { status: 400 });
  }
  if (!getBrand(brand)) {
    return NextResponse.json({ error: "unknown brand" }, { status: 404 });
  }

  const def = MARKDOWN_SECTIONS.find((s) => s.id === section);
  if (!def) {
    return NextResponse.json({ error: "unknown or non-markdown section" }, { status: 400 });
  }

  const filePath = path.join(getBrandContextDir(brand), def.file);
  let content = "";
  try {
    content = fs.readFileSync(filePath, "utf-8");
  } catch {
    // file doesn't exist yet — return empty
  }

  return NextResponse.json({ section: def.id, content });
}

export async function PUT(req: NextRequest) {
  const body = await req.json();
  const { brand, section, content } = body as {
    brand?: string;
    section?: string;
    content?: string;
  };

  if (!brand || !section || content === undefined) {
    return NextResponse.json({ error: "brand, section, and content required" }, { status: 400 });
  }
  if (!getBrand(brand)) {
    return NextResponse.json({ error: "unknown brand" }, { status: 404 });
  }

  const def = MARKDOWN_SECTIONS.find((s) => s.id === section);
  if (!def) {
    return NextResponse.json({ error: "unknown or non-markdown section" }, { status: 400 });
  }

  const dir = getBrandContextDir(brand);
  fs.mkdirSync(dir, { recursive: true });
  const filePath = path.join(dir, def.file);
  fs.writeFileSync(filePath, content, "utf-8");

  return NextResponse.json({ ok: true, section: def.id });
}
