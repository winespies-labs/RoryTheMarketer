import { NextRequest, NextResponse } from "next/server";
import { deleteReferenceAd } from "@/lib/reference-ads";

export async function DELETE(req: NextRequest) {
  const id = new URL(req.url).searchParams.get("id");
  if (!id) {
    return NextResponse.json({ error: "id is required" }, { status: 400 });
  }

  const deleted = deleteReferenceAd(id);
  if (!deleted) {
    return NextResponse.json({ error: "Reference ad not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
