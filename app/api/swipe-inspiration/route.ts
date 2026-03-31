import { NextRequest, NextResponse } from "next/server";
import { getBrand } from "@/lib/brands";
import {
  readSwipeInspiration,
  addSwipeInspirationItem,
  updateSwipeInspirationItem,
  deleteSwipeInspirationItem,
} from "@/lib/swipe-inspiration-storage";
import type { SwipeStyle, SwipeCategory } from "@/lib/swipe-inspiration";
import { STYLES, CATEGORIES } from "@/lib/swipe-inspiration";

const STYLE_VALUES = new Set<string>(STYLES.map((s) => s.value));
const CATEGORY_VALUES = new Set<string>(CATEGORIES.map((c) => c.value));

export async function GET(req: NextRequest) {
  const brandId = req.nextUrl.searchParams.get("brand");
  if (!brandId || !getBrand(brandId)) {
    return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
  }

  const type = req.nextUrl.searchParams.get("type") as "copy" | "image" | null;
  const style = req.nextUrl.searchParams.get("style") as SwipeStyle | null;
  const category = req.nextUrl.searchParams.get("category") as SwipeCategory | null;
  const q = req.nextUrl.searchParams.get("q")?.toLowerCase().trim();

  let items = (await readSwipeInspiration(brandId)).items;

  if (type) items = items.filter((i) => i.type === type);
  if (style) items = items.filter((i) => i.style === style);
  if (category) items = items.filter((i) => i.category === category);
  if (q) {
    items = items.filter(
      (i) =>
        (i.title?.toLowerCase().includes(q) ?? false) ||
        i.content.toLowerCase().includes(q) ||
        (i.tags?.some((t) => t.toLowerCase().includes(q)) ?? false) ||
        (i.style?.toLowerCase().includes(q) ?? false) ||
        (i.category?.toLowerCase().includes(q) ?? false)
    );
  }

  return NextResponse.json({
    items,
    styles: STYLES,
    categories: CATEGORIES,
  });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const brandId = body.brand;
  if (!brandId || !getBrand(brandId)) {
    return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
  }

  const type = body.type as "copy" | "image";
  if (type !== "copy" && type !== "image") {
    return NextResponse.json({ error: "type must be copy or image" }, { status: 400 });
  }

  if (type === "image") {
    return NextResponse.json(
      { error: "Use POST /api/swipe-inspiration/upload for image items" },
      { status: 400 }
    );
  }

  const style = body.style as string | undefined;
  const category = body.category as string | undefined;
  if (style && !STYLE_VALUES.has(style)) {
    return NextResponse.json({ error: "Invalid style" }, { status: 400 });
  }
  if (category && !CATEGORY_VALUES.has(category)) {
    return NextResponse.json({ error: "Invalid category" }, { status: 400 });
  }

  const item = await addSwipeInspirationItem(brandId, {
    type: "copy",
    content: body.content ?? "",
    title: body.title,
    style: style as SwipeStyle | undefined,
    category: category as SwipeCategory | undefined,
    tags: Array.isArray(body.tags) ? body.tags : undefined,
    useInContext: body.useInContext === true,
  });

  return NextResponse.json({ item });
}

export async function PATCH(req: NextRequest) {
  const body = await req.json();
  if (!body.brand || !body.id || !getBrand(body.brand)) {
    return NextResponse.json({ error: "Missing brand or id" }, { status: 400 });
  }

  const updates: Parameters<typeof updateSwipeInspirationItem>[2] = {};
  if (body.title !== undefined) updates.title = body.title;
  if (body.content !== undefined) updates.content = body.content;
  if (body.style !== undefined) {
    if (body.style && !STYLE_VALUES.has(body.style)) {
      return NextResponse.json({ error: "Invalid style" }, { status: 400 });
    }
    updates.style = body.style as SwipeStyle | undefined;
  }
  if (body.category !== undefined) {
    if (body.category && !CATEGORY_VALUES.has(body.category)) {
      return NextResponse.json({ error: "Invalid category" }, { status: 400 });
    }
    updates.category = body.category as SwipeCategory | undefined;
  }
  if (body.tags !== undefined) updates.tags = body.tags;
  if (body.useInContext !== undefined) updates.useInContext = body.useInContext;

  const updated = await updateSwipeInspirationItem(body.brand, body.id, updates);
  if (!updated) {
    return NextResponse.json({ error: "Item not found" }, { status: 404 });
  }
  return NextResponse.json({ item: updated });
}

export async function DELETE(req: NextRequest) {
  const brandId = req.nextUrl.searchParams.get("brand");
  const id = req.nextUrl.searchParams.get("id");
  if (!brandId || !id || !getBrand(brandId)) {
    return NextResponse.json({ error: "Missing brand or id" }, { status: 400 });
  }

  const ok = await deleteSwipeInspirationItem(brandId, id);
  return NextResponse.json({ ok });
}
