import { NextRequest, NextResponse } from "next/server";
import { getBrand } from "@/lib/brands";
import { getSwipeInspirationItemById } from "@/lib/swipe-inspiration-storage";
import { addContextLibraryItem } from "@/lib/context-library-storage";
import type { ContextLibraryItemType } from "@/lib/context-library";

/** Copy an inspiration item into the context library so it can be used in briefs/copywriter */
export async function POST(req: NextRequest) {
  const body = await req.json();
  const brandId = body.brand;
  const id = body.id;
  const contextType = (body.contextType as ContextLibraryItemType) || "swipe";

  if (!brandId || !id || !getBrand(brandId)) {
    return NextResponse.json({ error: "Invalid brand or id" }, { status: 400 });
  }

  const item = await getSwipeInspirationItemById(brandId, id);
  if (!item) {
    return NextResponse.json({ error: "Inspiration item not found" }, { status: 404 });
  }

  const validTypes: ContextLibraryItemType[] = [
    "copywriting",
    "ad_copy",
    "brief",
    "reference_ad",
    "swipe",
  ];
  if (!validTypes.includes(contextType)) {
    return NextResponse.json({ error: "Invalid contextType" }, { status: 400 });
  }

  const content =
    item.type === "image"
      ? (item.title ? `[Screenshot] ${item.title}\n\n` : "[Screenshot]\n\n") +
        (item.content || "No caption.")
      : item.content;

  const newContextItem = await addContextLibraryItem(brandId, {
    type: contextType,
    title: item.title,
    content,
    tags: item.tags,
  });

  return NextResponse.json({
    ok: true,
    contextItem: newContextItem,
  });
}
