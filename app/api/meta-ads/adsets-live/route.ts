import { NextRequest, NextResponse } from "next/server";
import { getBrand } from "@/lib/brands";
import { fetchAdSetsLive } from "@/lib/meta-publish";

export async function GET(req: NextRequest) {
  const brand = req.nextUrl.searchParams.get("brand") ?? "winespies";

  if (!getBrand(brand)) {
    return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
  }

  try {
    const adsets = await fetchAdSetsLive(brand);
    return NextResponse.json({ brand, adsets });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch ad sets";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
