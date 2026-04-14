import { NextRequest, NextResponse } from "next/server";
import { getBrand } from "@/lib/brands";
import { type TimeRange, type MetaCampaign, type MetaInsights, TIME_RANGES } from "@/lib/meta-ads";
import { readMetaCampaigns } from "@/lib/meta-ads-storage";
import { useDatabase } from "@/lib/database";
import { readCampaignsFromDB } from "@/lib/meta-ads-db";

type ProjectedCampaign = Omit<MetaCampaign, "insights"> & { insights: MetaInsights | null };

export async function GET(req: NextRequest) {
  const brand = req.nextUrl.searchParams.get("brand");
  const timeRange = (req.nextUrl.searchParams.get("timeRange") ?? "last_7d") as TimeRange;

  if (!brand || !getBrand(brand)) {
    return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
  }
  if (!TIME_RANGES.includes(timeRange)) {
    return NextResponse.json({ error: "Invalid timeRange" }, { status: 400 });
  }

  const data = useDatabase()
    ? await readCampaignsFromDB(brand)
    : readMetaCampaigns(brand);
  if (!data) {
    return NextResponse.json({ syncedAt: null, accountId: null, timeRange, campaigns: [] });
  }

  const campaigns: ProjectedCampaign[] = data.campaigns.map((c) => {
    const { insights, ...rest } = c;
    return { ...rest, insights: insights?.[timeRange] ?? null };
  });

  return NextResponse.json({
    syncedAt: data.syncedAt,
    accountId: data.accountId,
    timeRange,
    campaigns,
  });
}
