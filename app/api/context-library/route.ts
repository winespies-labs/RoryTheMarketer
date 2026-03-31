import { NextRequest, NextResponse } from "next/server";
import { getBrand } from "@/lib/brands";
import {
  readContextLibrary,
  addContextLibraryItem,
  updateContextLibraryItem,
  deleteContextLibraryItem,
} from "@/lib/context-library-storage";
import type { ContextLibraryItemType } from "@/lib/context-library";

export async function GET(req: NextRequest) {
  const brandId = req.nextUrl.searchParams.get("brand");
  if (!brandId || !getBrand(brandId)) {
    return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
  }

  const type = req.nextUrl.searchParams.get("type") as ContextLibraryItemType | null;
  const q = req.nextUrl.searchParams.get("q")?.toLowerCase().trim();

  const data = await readContextLibrary(brandId);
  let items = data.items;

  if (type) items = items.filter((i) => i.type === type);
  if (q) {
    items = items.filter(
      (i) =>
        (i.title?.toLowerCase().includes(q) ?? false) ||
        (typeof i.content === "string" ? i.content.toLowerCase().includes(q) : false) ||
        (i.tags?.some((t) => t.toLowerCase().includes(q)) ?? false)
    );
  }

  return NextResponse.json({ items });
}

const VALID_TYPES = ["copywriting", "ad_copy", "brief", "reference_ad", "swipe"];

export async function POST(req: NextRequest) {
  const body = await req.json();
  const brandId = body.brand;
  if (!brandId || !getBrand(brandId)) {
    return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
  }
  if (!body.type || !VALID_TYPES.includes(body.type)) {
    return NextResponse.json({ error: "Invalid type" }, { status: 400 });
  }

  const item = await addContextLibraryItem(brandId, {
    type: body.type,
    title: body.title,
    content: body.content ?? "",
    meta: body.meta,
    tags: body.tags,
  });
  return NextResponse.json({ id: item.id, item });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  if (!body.brand || !body.id || !getBrand(body.brand)) {
    return NextResponse.json({ error: "Missing brand or id" }, { status: 400 });
  }

  const updates: Record<string, unknown> = {};
  if (body.title !== undefined) updates.title = body.title;
  if (body.content !== undefined) updates.content = body.content;
  if (body.meta !== undefined) updates.meta = body.meta;
  if (body.tags !== undefined) updates.tags = body.tags;
  if (body.type !== undefined) {
    if (!VALID_TYPES.includes(body.type)) {
      return NextResponse.json({ error: "Invalid type" }, { status: 400 });
    }
    updates.type = body.type;
  }

  const updated = await updateContextLibraryItem(body.brand, body.id, updates as any);
  if (!updated) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
  return NextResponse.json(updated);
}

export async function DELETE(req: NextRequest) {
  const brandId = req.nextUrl.searchParams.get("brand");
  const id = req.nextUrl.searchParams.get("id");
  if (!brandId || !id || !getBrand(brandId)) {
    return NextResponse.json({ error: "Missing brand or id" }, { status: 400 });
  }

  const ok = await deleteContextLibraryItem(brandId, id);
  return NextResponse.json({ ok });
}
