import { NextRequest, NextResponse } from "next/server";
import { nanoid } from "nanoid";
import { getBrand } from "@/lib/brands";
import { readContextLibrary, writeContextLibrary } from "@/lib/context-library-storage";
import { parseSwipeMarkdownToItems } from "@/lib/import-swipe-markdown";
import type { ContextLibraryItem, ContextLibraryItemType } from "@/lib/context-library";

const DEFAULT_TYPE: ContextLibraryItemType = "swipe";

export async function POST(req: NextRequest) {
  try {
    let body: Record<string, unknown>;
    try {
      body = (await req.json()) as Record<string, unknown>;
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const brandId = body.brand as string | undefined;
    const markdown = body.markdown as string | undefined;
    const overwrite = body.overwrite !== false;
    const itemType: ContextLibraryItemType =
      (body.type as ContextLibraryItemType) ?? DEFAULT_TYPE;

    if (!brandId || !getBrand(brandId)) {
      return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
    }
    if (!markdown || typeof markdown !== "string" || !markdown.trim()) {
      return NextResponse.json({ error: "Missing markdown" }, { status: 400 });
    }

    const parsed = parseSwipeMarkdownToItems(markdown);
    const nowIso = new Date().toISOString();

    // If we're not overwriting, do a simple dedupe by (title + content).
    const existing = overwrite ? null : await readContextLibrary(brandId);
    const seen = new Set(
      existing?.items.map((i) => `${i.title ?? ""}\n${i.content}`) ?? []
    );

    const nextItems: ContextLibraryItem[] = [];
    for (const p of parsed) {
      const key = `${p.title}\n${p.content}`;
      if (!overwrite && seen.has(key)) continue;
      nextItems.push({
        id: nanoid(),
        type: itemType,
        title: p.title,
        content: p.content,
        tags: p.tags,
        addedAt: nowIso,
      });
    }

    if (overwrite) {
      await writeContextLibrary(brandId, { updatedAt: nowIso, items: nextItems });
    } else {
      const merged = existing ? [...existing.items, ...nextItems] : nextItems;
      await writeContextLibrary(brandId, { updatedAt: nowIso, items: merged });
    }

    return NextResponse.json({
      ok: true,
      overwrite,
      parsedCount: parsed.length,
      insertedCount: nextItems.length,
    });
  } catch (err) {
    console.error("[swipe-files/import]", err);
    const message =
      err instanceof Error ? err.message : "Import failed (server error)";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

