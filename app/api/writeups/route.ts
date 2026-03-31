import { NextRequest, NextResponse } from "next/server";
import { readWriteups, createWriteup } from "@/lib/writeups-storage";

export async function GET(req: NextRequest) {
  const brand = req.nextUrl.searchParams.get("brand") || "winespies";
  const status = req.nextUrl.searchParams.get("status") as "draft" | "published" | null;
  const data = await readWriteups(brand, status || undefined);
  return NextResponse.json(data.writeups);
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const brand = body.brand || "winespies";
  const { title, content, status, score } = body;
  if (!content) {
    return NextResponse.json({ error: "content required" }, { status: 400 });
  }
  const writeup = await createWriteup(brand, {
    title: title || "Untitled",
    content,
    status,
    score,
  });
  return NextResponse.json(writeup);
}
