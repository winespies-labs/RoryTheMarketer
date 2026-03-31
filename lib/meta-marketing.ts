import { getBrand } from "@/lib/brands";
import { graphGet, graphGetAllPages } from "@/lib/meta-graph";

export type MetaAd = {
  id: string;
  name?: string;
  effective_object_story_id?: string;
  effective_status?: string;
  campaign_id?: string;
};

export function getAdAccountId(brandId: string): string {
  const brand = getBrand(brandId);
  const id = brand?.metaAdAccountId ?? process.env.META_AD_ACCOUNT_ID;
  if (!id) {
    throw new Error("Missing META_AD_ACCOUNT_ID (set env var or brand.metaAdAccountId)");
  }
  // Accept either "act_123" or "123"
  return id.startsWith("act_") ? id : `act_${id}`;
}

export async function fetchRunningAdsWithStoryIds(input: {
  brandId: string;
  campaignIds?: string[];
  adIds?: string[];
  limitAds?: number;
}): Promise<MetaAd[]> {
  const { brandId, campaignIds, adIds, limitAds } = input;
  const accountId = getAdAccountId(brandId);

  const fields = ["id", "name", "effective_object_story_id", "effective_status", "campaign_id"].join(",");

  // If explicit adIds are provided, fetch via batch-by-id (simple loop; low volume expected).
  if (Array.isArray(adIds) && adIds.length > 0) {
    const uniq = Array.from(new Set(adIds.filter((s) => typeof s === "string" && s.trim()))).slice(
      0,
      limitAds ?? adIds.length
    );
    const out: MetaAd[] = [];
    for (const adId of uniq) {
      const ad = await graphGet<MetaAd>(`/${adId}`, { fields }).catch(() => null);
      if (ad?.id) out.push(ad);
    }
    return out;
  }

  const params: Record<string, string | number | boolean | undefined> = {
    fields,
    limit: 100,
    // This is the key part: only currently running ads
    effective_status: ["ACTIVE"].join(","),
  };

  // If campaignIds are provided, filter via Marketing API filtering param.
  if (Array.isArray(campaignIds) && campaignIds.length > 0) {
    const filt = [
      {
        field: "campaign.id",
        operator: "IN",
        value: Array.from(new Set(campaignIds.filter((s) => typeof s === "string" && s.trim()))),
      },
    ];
    params.filtering = JSON.stringify(filt);
  }

  const ads = await graphGetAllPages<MetaAd>(`/${accountId}/ads`, params, {
    maxItems: limitAds ?? 500,
  });

  return ads;
}

