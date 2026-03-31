import { NextRequest, NextResponse } from "next/server";
import { getBrand } from "@/lib/brands";
import { type TimeRange, DEFAULT_TIME_RANGES, TIME_RANGES } from "@/lib/meta-ads";
import { fetchCampaigns, fetchAdSets, fetchAds } from "@/lib/meta-ads-api";
import { writeMetaCampaigns, writeMetaAdSets, writeMetaAds } from "@/lib/meta-ads-storage";
import { getAdAccountId } from "@/lib/meta-marketing";
import { useDatabase } from "@/lib/database";
import { upsertCampaigns, upsertAdSets, upsertAds, logSync } from "@/lib/meta-ads-db";

export const maxDuration = 120;

export async function POST(req: NextRequest) {
  const body = await req.json();
  const brandId = body.brand as string | undefined;
  const rawRanges = body.timeRanges as string[] | undefined;

  if (!brandId || !getBrand(brandId)) {
    return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
  }

  // Validate time ranges if provided; default to just last_7d to avoid rate limits
  const timeRanges: TimeRange[] = Array.isArray(rawRanges)
    ? rawRanges.filter((r): r is TimeRange => TIME_RANGES.includes(r as TimeRange))
    : ["last_7d"];

  if (timeRanges.length === 0) {
    return NextResponse.json({ error: "No valid time ranges" }, { status: 400 });
  }

  try {
    const accountId = getAdAccountId(brandId);
    const syncedAt = new Date().toISOString();

    // Fetch sequentially with small delays to avoid rate limits
    const campaigns = await fetchCampaigns(brandId, timeRanges);
    await new Promise((r) => setTimeout(r, 1000));
    const adsets = await fetchAdSets(brandId, timeRanges);
    await new Promise((r) => setTimeout(r, 1000));
    const ads = await fetchAds(brandId, timeRanges);

    // Write all three files
    writeMetaCampaigns(brandId, { syncedAt, accountId, timeRanges, campaigns });
    writeMetaAdSets(brandId, { syncedAt, accountId, timeRanges, adsets });
    writeMetaAds(brandId, { syncedAt, accountId, timeRanges, ads });

    // Persist to database if available
    if (useDatabase()) {
      try {
        const syncDate = new Date(syncedAt);
        await upsertCampaigns(brandId, accountId, campaigns, syncDate);
        await upsertAdSets(brandId, accountId, adsets, syncDate);
        await upsertAds(brandId, accountId, ads, syncDate);
        await logSync(brandId, "full", "success", {
          campaigns: campaigns.length,
          adsets: adsets.length,
          ads: ads.length,
        });
      } catch (dbErr) {
        console.error("DB persist failed (JSON still written):", dbErr);
        await logSync(brandId, "full", "error", undefined, String(dbErr)).catch(() => {});
      }
    }

    return NextResponse.json({
      ok: true,
      syncedAt,
      campaignsCount: campaigns.length,
      adsetsCount: adsets.length,
      adsCount: ads.length,
      timeRanges,
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Sync failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
