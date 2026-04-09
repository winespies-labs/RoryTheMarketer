// app/api/pdp/publish/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getBrand } from "@/lib/brands";
import {
  uploadAdImage,
  createAdCreative,
  createAd,
  fetchAdSetsLive,
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
  jobs: PublishJob[];
}

export async function POST(req: NextRequest) {
  let body: PublishRequest;
  try {
    body = await req.json() as PublishRequest;
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const { brand, adSetId, jobs } = body;

  if (!getBrand(brand)) {
    return NextResponse.json({ error: "Unknown brand" }, { status: 400 });
  }

  if (!adSetId) {
    return NextResponse.json(
      { error: "New ad set creation requires a campaign ID. Please select an existing ad set." },
      { status: 400 }
    );
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
          adsetId: adSetId,
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
