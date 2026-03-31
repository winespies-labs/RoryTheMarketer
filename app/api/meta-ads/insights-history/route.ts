import { NextRequest, NextResponse } from "next/server";
import { getBrand } from "@/lib/brands";
import { useDatabase } from "@/lib/database";
import { queryDailyInsights } from "@/lib/meta-ads-db";

export async function GET(req: NextRequest) {
  const brand = req.nextUrl.searchParams.get("brand");
  const since = req.nextUrl.searchParams.get("since");
  const until = req.nextUrl.searchParams.get("until");

  if (!brand || !getBrand(brand)) {
    return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
  }
  if (!since || !until) {
    return NextResponse.json({ error: "Missing since/until params" }, { status: 400 });
  }

  if (!useDatabase()) {
    return NextResponse.json(
      { error: "Database not configured — historical insights unavailable" },
      { status: 503 },
    );
  }

  try {
    const days = await queryDailyInsights(brand, since, until);
    return NextResponse.json({ days });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to query insights history";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
