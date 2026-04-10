import { NextRequest, NextResponse } from "next/server";
import { readWriteups, updateWriteup, deleteWriteup } from "@/lib/writeups-storage";

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const brand = req.nextUrl.searchParams.get("brand") || "winespies";
  const data = await readWriteups(brand);
  const writeup = data.writeups.find((w) => w.id === id) ?? null;
  if (!writeup) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(writeup);
}

export async function PUT(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const body = await req.json();
  const brand = body.brand || "winespies";
  const result = await updateWriteup(brand, id, {
    title: body.title,
    content: body.content,
    status: body.status,
    score: body.score,
  });
  if (!result) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json(result);
}

export async function DELETE(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const brand = req.nextUrl.searchParams.get("brand") || "winespies";
  const ok = await deleteWriteup(brand, id);
  if (!ok) {
    return NextResponse.json({ error: "not found" }, { status: 404 });
  }
  return NextResponse.json({ ok: true });
}
