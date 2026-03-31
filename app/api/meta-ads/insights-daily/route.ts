import { NextRequest, NextResponse } from "next/server";
import { getBrand } from "@/lib/brands";
import { type TimeRange, TIME_RANGES, timeRangeToDates } from "@/lib/meta-ads";
import { getAdAccountId } from "@/lib/meta-marketing";
import { graphGet } from "@/lib/meta-graph";
import { actionValue } from "@/app/ads-manager/lib/insights-helpers";
import type { MetaActionValue } from "@/lib/meta-ads";
import { useDatabase } from "@/lib/database";
import { upsertDailyInsights, logSync } from "@/lib/meta-ads-db";

type MetaDailyRow = {
  date_start: string;
  date_stop: string;
  spend?: string;
  impressions?: string;
  clicks?: string;
  cpc?: string;
  cpm?: string;
  ctr?: string;
  actions?: MetaActionValue[];
  action_values?: MetaActionValue[];
};

type MetaInsightsResponse = {
  data: MetaDailyRow[];
  paging?: { next?: string };
};

export type DailyInsight = {
  date: string;
  spend: number;
  revenue: number;
  roas: number;
  purchases: number;
  cpa: number;
  clicks: number;
  impressions: number;
  ctr: number;
  cpc: number;
  cpm: number;
};

export async function GET(req: NextRequest) {
  const brand = req.nextUrl.searchParams.get("brand");
  const timeRange = (req.nextUrl.searchParams.get("timeRange") ?? "last_7d") as TimeRange;

  if (!brand || !getBrand(brand)) {
    return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
  }
  if (!TIME_RANGES.includes(timeRange)) {
    return NextResponse.json({ error: "Invalid timeRange" }, { status: 400 });
  }

  try {
    const accountId = getAdAccountId(brand);
    const { since, until } = timeRangeToDates(timeRange);

    const result = await graphGet<MetaInsightsResponse>(`/${accountId}/insights`, {
      time_increment: 1,
      time_range: JSON.stringify({ since, until }),
      fields: "spend,impressions,clicks,cpc,cpm,ctr,actions,action_values",
      limit: 100,
    });

    const days: DailyInsight[] = (result.data ?? []).map((row) => {
      const spend = parseFloat(row.spend ?? "0");
      let revenue = actionValue(row.action_values, "purchase");
      if (!revenue) revenue = actionValue(row.action_values, "offsite_conversion.fb_pixel_purchase");
      let purchases = actionValue(row.actions, "purchase");
      if (!purchases) purchases = actionValue(row.actions, "offsite_conversion.fb_pixel_purchase");
      const roas = spend > 0 ? revenue / spend : 0;
      const cpa = purchases > 0 ? spend / purchases : 0;

      return {
        date: row.date_start,
        spend,
        revenue,
        roas,
        purchases,
        cpa,
        clicks: parseFloat(row.clicks ?? "0"),
        impressions: parseFloat(row.impressions ?? "0"),
        ctr: parseFloat(row.ctr ?? "0"),
        cpc: parseFloat(row.cpc ?? "0"),
        cpm: parseFloat(row.cpm ?? "0"),
      };
    });

    // Persist to database if available
    if (useDatabase()) {
      try {
        await upsertDailyInsights(brand, accountId, days);
        await logSync(brand, "daily", "success", { days: days.length });
      } catch (dbErr) {
        console.error("DB persist of daily insights failed:", dbErr);
      }
    }

    return NextResponse.json({ days });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Failed to fetch daily insights";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
