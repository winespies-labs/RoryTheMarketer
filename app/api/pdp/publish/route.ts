// app/api/pdp/publish/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getBrand } from "@/lib/brands";
import {
  uploadAdImage,
  createAdCreative,
  createAd,
  fetchAdSetsLive,
  fetchCampaignsLive,
  fetchAudiencesLive,
  createAdSet,
  type NewAdSetInput,
} from "@/lib/meta-publish";
import { getAdSettings, applyUtm, buildDegreesOfFreedomSpec } from "@/lib/ad-settings";

export const maxDuration = 120;

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const action = searchParams.get("action");
  const brand = searchParams.get("brand") ?? "winespies";

  if (!getBrand(brand)) {
    return NextResponse.json({ error: "Unknown brand" }, { status: 400 });
  }

  if (action === "adsets") {
    try {
      const adSets = await fetchAdSetsLive(brand);
      return NextResponse.json({ adSets });
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Failed to fetch ad sets";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  if (action === "preflight") {
    const missing: string[] = [];
    if (!process.env.META_ACCESS_TOKEN) missing.push("META_ACCESS_TOKEN");
    const brandObj = getBrand(brand);
    if (!brandObj?.metaPageId && !process.env.META_PAGE_ID)
      missing.push("META_PAGE_ID");
    return NextResponse.json({ ok: missing.length === 0, missing });
  }

  if (action === "campaigns") {
    try {
      const campaigns = await fetchCampaignsLive(brand);
      return NextResponse.json({ campaigns });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to fetch campaigns";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  if (action === "audiences") {
    try {
      const audiences = await fetchAudiencesLive(brand);
      return NextResponse.json({ audiences });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to fetch audiences";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  return NextResponse.json({ error: "Unknown action" }, { status: 400 });
}

interface PublishJob {
  jobId: string;
  imageBase64: string;
  mimeType: string;
  wineName: string;
  headline: string;
  primary_text: string;
  description: string;
  saleUrl: string;
}

interface PerWineAdSetDefaults {
  campaignId: string;
  budgetCents: number;
  bidStrategy: "LOWEST_COST_WITHOUT_CAP" | "COST_CAP" | "BID_CAP";
  bidAmountCents?: number;
}

interface PublishRequest {
  brand: string;
  adSetId: string | null;
  newAdSet?: NewAdSetInput;
  jobs: PublishJob[];
  perWineAdSetDefaults?: PerWineAdSetDefaults;
}

export async function POST(req: NextRequest) {
  let body: PublishRequest;
  try {
    body = await req.json() as PublishRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { brand, adSetId, newAdSet, jobs } = body;
  const { perWineAdSetDefaults } = body;

  if (!getBrand(brand)) {
    return NextResponse.json({ error: "Unknown brand" }, { status: 400 });
  }

  const adSettings = getAdSettings(brand);
  const degreesOfFreedomSpec = buildDegreesOfFreedomSpec(
    adSettings.creativeEnhancements.images,
  );

  // In per-wine mode, adsets are created per job below — skip shared resolution
  let sharedAdSetId: string | null = null;
  if (!perWineAdSetDefaults) {
    sharedAdSetId = adSetId;
    if (!sharedAdSetId) {
      if (!newAdSet) {
        return NextResponse.json(
          { error: "Must provide adSetId, newAdSet, or perWineAdSetDefaults" },
          { status: 400 },
        );
      }
      try {
        const { id } = await createAdSet(brand, newAdSet);
        sharedAdSetId = id;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to create ad set";
        return NextResponse.json(
          { error: `Ad set creation failed: ${msg}` },
          { status: 500 },
        );
      }
    }
  }

  if (!jobs?.length) {
    return NextResponse.json({ error: "No jobs provided" }, { status: 400 });
  }

  const results = await Promise.all(
    jobs.map(async (job) => {
      try {
        // Resolve adset — create per-wine if in that mode
        let resolvedAdSetId: string;
        if (perWineAdSetDefaults) {
          const { id } = await createAdSet(brand, {
            campaignId: perWineAdSetDefaults.campaignId,
            name: job.wineName,
            budgetType: "daily",
            budgetCents: perWineAdSetDefaults.budgetCents,
            startTime: new Date().toISOString(),
            optimizationGoal: "OFFSITE_CONVERSIONS",
            bidStrategy: perWineAdSetDefaults.bidStrategy,
            bidAmountCents: perWineAdSetDefaults.bidAmountCents,
            targeting: { geoCountries: ["US"], ageMin: 21, ageMax: 65 },
            placementMode: "automatic",
          });
          resolvedAdSetId = id;
        } else {
          if (!sharedAdSetId) {
            throw new Error("Internal: sharedAdSetId is null in shared adset mode");
          }
          resolvedAdSetId = sharedAdSetId;
        }

        // Apply UTM to destination URL
        const link = applyUtm(job.saleUrl, adSettings.utm);

        const { hash } = await uploadAdImage(brand, job.imageBase64);
        const { id: creativeId } = await createAdCreative(brand, {
          name: `PDP — ${job.wineName}`,
          imageHash: hash,
          primaryText: job.primary_text,
          headline: job.headline,
          description: job.description,
          link,
          ctaType: "SHOP_NOW",
          degreesOfFreedomSpec,
        });
        const { id: adId } = await createAd(brand, {
          name: `PDP — ${job.wineName}`,
          adsetId: resolvedAdSetId,
          creativeId,
          status: "ACTIVE",
        });
        return { jobId: job.jobId, success: true as const, adId };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Publish failed";
        return { jobId: job.jobId, success: false as const, error: msg };
      }
    }),
  );

  return NextResponse.json({ results });
}
