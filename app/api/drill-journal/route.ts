import { NextRequest, NextResponse } from "next/server";
import { readDrillJournal, addDrillJournalEntry } from "@/lib/drill-journal-storage";
import { addContextLibraryItem } from "@/lib/context-library-storage";

export async function GET(req: NextRequest) {
  const brand = req.nextUrl.searchParams.get("brand") || "winespies";
  const data = readDrillJournal(brand);
  return NextResponse.json(data.entries);
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const brand = body.brand || "winespies";
    const {
      techniqueId,
      techniqueLabel,
      drillId,
      drillTitle,
      mechanism,
      originalSwipe,
      userVersion,
    } = body;

    if (!userVersion?.trim()) {
      return NextResponse.json({ error: "userVersion required" }, { status: 400 });
    }

    // Save to context library as a swipe
    const contextItem = await addContextLibraryItem(brand, {
      type: "swipe",
      title: `${techniqueLabel}: ${drillTitle}`,
      content: userVersion,
      tags: ["drill", techniqueId],
      meta: {
        source: "drill",
        techniqueId,
        drillId,
        mechanism,
      },
    });

    // Save to drill journal with the context library reference
    const entry = addDrillJournalEntry(brand, {
      techniqueId,
      techniqueLabel,
      drillId,
      drillTitle,
      mechanism,
      originalSwipe,
      userVersion,
      contextLibraryItemId: contextItem.id,
    });

    return NextResponse.json({ entry, contextItemId: contextItem.id });
  } catch (err: unknown) {
    console.error("Drill journal save error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
