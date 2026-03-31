import { NextResponse } from "next/server";

const FEED_URL = "https://winespies.com/sales/current.json";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let cached: { data: unknown; fetchedAt: number } | null = null;

export async function GET() {
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json(cached.data);
  }

  try {
    const res = await fetch(FEED_URL, { next: { revalidate: 300 } });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Feed returned ${res.status}` },
        { status: 502 },
      );
    }
    const data = await res.json();
    cached = { data, fetchedAt: Date.now() };
    return NextResponse.json(data);
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to fetch wine feed" },
      { status: 502 },
    );
  }
}
