import { NextRequest, NextResponse } from "next/server";
import { getBrand } from "@/lib/brands";
import { type TimeRange, type MetaAdSet, type MetaInsights, TIME_RANGES } from "@/lib/meta-ads";
import { readMetaAdSets } from "@/lib/meta-ads-storage";

type ProjectedAdSet = Omit<MetaAdSet, "insights"> & { insights: MetaInsights | null };

export async function GET(req: NextRequest) {
  const brand = req.nextUrl.searchParams.get("brand");
  const timeRange = (req.nextUrl.searchParams.get("timeRange") ?? "last_7d") as TimeRange;
  const campaignId = req.nextUrl.searchParams.get("campaignId");

  if (!brand || !getBrand(brand)) {
    return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
  }
  if (!TIME_RANGES.includes(timeRange)) {
    return NextResponse.json({ error: "Invalid timeRange" }, { status: 400 });
  }

  const data = readMetaAdSets(brand);
  if (!data) {
    return NextResponse.json({ syncedAt: null, accountId: null, timeRange, adsets: [] });
  }

  let filtered = data.adsets;
  if (campaignId) {
    filtered = filtered.filter((a) => a.campaign_id === campaignId);
  }

  const adsets: ProjectedAdSet[] = filtered.map((a) => {
    const { insights, ...rest } = a;
    return { ...rest, insights: insights?.[timeRange] ?? null };
  });

  return NextResponse.json({
    syncedAt: data.syncedAt,
    accountId: data.accountId,
    timeRange,
    adsets,
  });
}
