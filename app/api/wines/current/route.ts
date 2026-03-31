import { NextResponse } from "next/server";
import { fetchCurrentWines } from "@/lib/wine-feed";

export async function GET() {
  try {
    const data = await fetchCurrentWines();
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch wine feed" },
      { status: 502 },
    );
  }
}
