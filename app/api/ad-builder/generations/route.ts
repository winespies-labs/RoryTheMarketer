import { NextRequest, NextResponse } from "next/server";
import { getBrand } from "@/lib/brands";
import { readGenerations, deleteGeneration } from "@/lib/ad-builder-storage";

export async function GET(req: NextRequest) {
  const brandId = req.nextUrl.searchParams.get("brand");
  if (!brandId || !getBrand(brandId)) {
    return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
  }

  const data = readGenerations(brandId);
  const sorted = [...data.generations].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  return NextResponse.json({ generations: sorted });
}

export async function DELETE(req: NextRequest) {
  const brandId = req.nextUrl.searchParams.get("brand");
  const id = req.nextUrl.searchParams.get("id");

  if (!brandId || !id || !getBrand(brandId)) {
    return NextResponse.json(
      { error: "Missing brand or id" },
      { status: 400 }
    );
  }

  const ok = deleteGeneration(brandId, id);
  if (!ok) {
    return NextResponse.json(
      { error: "Generation not found" },
      { status: 404 }
    );
  }

  return NextResponse.json({ ok: true });
}
