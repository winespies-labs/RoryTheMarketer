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

interface PublishRequest {
  brand: string;
  adSetId: string | null;
  newAdSet?: NewAdSetInput;
  jobs: PublishJob[];
}

export async function POST(req: NextRequest) {
  let body: PublishRequest;
  try {
    body = await req.json() as PublishRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { brand, adSetId, newAdSet, jobs } = body;

  if (!getBrand(brand)) {
    return NextResponse.json({ error: "Unknown brand" }, { status: 400 });
  }

  let resolvedAdSetId = adSetId;

  if (!resolvedAdSetId) {
    if (!newAdSet) {
      return NextResponse.json(
        { error: "Must provide adSetId or newAdSet" },
        { status: 400 },
      );
    }
    try {
      const { id } = await createAdSet(brand, newAdSet);
      resolvedAdSetId = id;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to create ad set";
      return NextResponse.json(
        { error: `Ad set creation failed: ${msg}` },
        { status: 500 },
      );
    }
  }

  if (!jobs?.length) {
    return NextResponse.json({ error: "No jobs provided" }, { status: 400 });
  }

  const results = await Promise.all(
    jobs.map(async (job) => {
      try {
        const { hash } = await uploadAdImage(brand, job.imageBase64);
        const { id: creativeId } = await createAdCreative(brand, {
          name: `PDP — ${job.wineName}`,
          imageHash: hash,
          primaryText: job.primary_text,
          headline: job.headline,
          description: job.description,
          link: job.saleUrl,
          ctaType: "SHOP_NOW",
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
    })
  );

  return NextResponse.json({ results });
}
