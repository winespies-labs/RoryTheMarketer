import { graphPost, graphGet } from "@/lib/meta-graph";
import { getAdAccountId } from "@/lib/meta-marketing";
import { getBrand } from "@/lib/brands";

// --- Types ---

export type UploadImageResult = {
  hash: string;
};

export type CreateCreativeResult = {
  id: string;
};

export type CreateAdResult = {
  id: string;
};

export type MetaAdSetLive = {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  campaign_id?: string;
  daily_budget?: string;
  lifetime_budget?: string;
};

export type MetaCampaignLive = {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  objective: string;
  budget_rebalance_flag?: boolean;
};

export type MetaAudience = {
  id: string;
  name: string;
  subtype: string;
};

export type NewAdSetInput = {
  campaignId: string;
  name: string;
  budgetType: "daily" | "lifetime";
  /** Amount in cents (dollars × 100) */
  budgetCents: number;
  /** ISO 8601 string */
  startTime: string;
  /** ISO 8601 string — required for lifetime budget */
  endTime?: string;
  /** e.g. "OFFSITE_CONVERSIONS", "LINK_CLICKS", "REACH" */
  optimizationGoal: string;
  bidStrategy: "LOWEST_COST_WITHOUT_CAP" | "COST_CAP" | "BID_CAP";
  /** In cents — required for COST_CAP / BID_CAP */
  bidAmountCents?: number;
  targeting: {
    geoCountries: string[];
    ageMin: number;
    ageMax: number;
    /** 1 = male, 2 = female — omit for all genders */
    genders?: number[];
    customAudiences?: { id: string; name: string }[];
  };
  placementMode: "automatic" | "manual";
  publisherPlatforms?: string[];
  facebookPositions?: string[];
  instagramPositions?: string[];
};

// --- Functions ---

export async function uploadAdImage(
  brandId: string,
  imageBase64: string,
): Promise<UploadImageResult> {
  const accountId = getAdAccountId(brandId);

  const result = await graphPost<{
    images: Record<string, { hash: string }>;
  }>(`${accountId}/adimages`, {
    bytes: imageBase64,
  });

  // Meta returns { images: { bytes: { hash: "abc123" } } }
  const hashEntry = Object.values(result.images ?? {})[0];
  if (!hashEntry?.hash) {
    throw new Error("Failed to upload image — no hash returned");
  }

  return { hash: hashEntry.hash };
}

export async function createAdCreative(
  brandId: string,
  input: {
    name: string;
    imageHash: string;
    primaryText: string;
    headline: string;
    description: string;
    link: string;
    ctaType?: string;
    degreesOfFreedomSpec?: Record<string, unknown>;
  },
): Promise<CreateCreativeResult> {
  const accountId = getAdAccountId(brandId);
  const brand = getBrand(brandId);
  const pageId = brand?.metaPageId ?? process.env.META_PAGE_ID;
  if (!pageId) {
    throw new Error("Missing META_PAGE_ID (set env var or brand.metaPageId)");
  }

  const objectStorySpec = JSON.stringify({
    page_id: pageId,
    link_data: {
      image_hash: input.imageHash,
      message: input.primaryText,
      link: input.link,
      name: input.headline,
      description: input.description,
      call_to_action: {
        type: input.ctaType ?? "SHOP_NOW",
        value: { link: input.link },
      },
    },
  });

  const body: Record<string, string | number | boolean | undefined> = {
    name: input.name,
    object_story_spec: objectStorySpec,
  };
  if (input.degreesOfFreedomSpec) {
    body.degrees_of_freedom_spec = JSON.stringify(input.degreesOfFreedomSpec);
  }

  const result = await graphPost<{ id: string }>(
    `${accountId}/adcreatives`,
    body,
  );

  if (!result.id) {
    throw new Error("Failed to create ad creative — no ID returned");
  }

  return { id: result.id };
}

export async function createAd(
  brandId: string,
  input: {
    name: string;
    adsetId: string;
    creativeId: string;
    status?: string;
  },
): Promise<CreateAdResult> {
  const accountId = getAdAccountId(brandId);

  const result = await graphPost<{ id: string }>(`${accountId}/ads`, {
    name: input.name,
    adset_id: input.adsetId,
    creative: JSON.stringify({ creative_id: input.creativeId }),
    status: input.status ?? "ACTIVE",
  });

  if (!result.id) {
    throw new Error("Failed to create ad — no ID returned");
  }

  return { id: result.id };
}

export async function fetchAdSetsLive(
  brandId: string,
): Promise<MetaAdSetLive[]> {
  const accountId = getAdAccountId(brandId);
  const fields = "id,name,status,effective_status,campaign_id,daily_budget,lifetime_budget";

  const result = await graphGet<{ data: MetaAdSetLive[] }>(
    `${accountId}/adsets`,
    { fields, limit: 100 },
  );

  return result.data ?? [];
}

export async function fetchCampaignsLive(
  brandId: string,
): Promise<MetaCampaignLive[]> {
  const accountId = getAdAccountId(brandId);
  const fields =
    "id,name,status,effective_status,objective,budget_rebalance_flag";

  const result = await graphGet<{ data: MetaCampaignLive[] }>(
    `${accountId}/campaigns`,
    { fields, limit: 100 },
  );

  return (result.data ?? []).filter(
    (c) =>
      c.effective_status === "ACTIVE" || c.effective_status === "PAUSED",
  );
}

export async function fetchAudiencesLive(
  brandId: string,
): Promise<MetaAudience[]> {
  const accountId = getAdAccountId(brandId);

  const result = await graphGet<{ data: MetaAudience[] }>(
    `${accountId}/customaudiences`,
    { fields: "id,name,subtype", limit: 200 },
  );

  return result.data ?? [];
}

export async function createAdSet(
  brandId: string,
  input: NewAdSetInput,
): Promise<{ id: string }> {
  const accountId = getAdAccountId(brandId);

  // Build targeting spec
  const targetingSpec: Record<string, unknown> = {
    geo_locations: { countries: input.targeting.geoCountries },
    age_min: input.targeting.ageMin,
    ...(input.targeting.ageMax < 65
      ? { age_max: input.targeting.ageMax }
      : {}),
  };
  if (input.targeting.genders?.length) {
    targetingSpec.genders = input.targeting.genders;
  }
  if (input.targeting.customAudiences?.length) {
    targetingSpec.custom_audiences = input.targeting.customAudiences;
  }

  // Merge manual placements into targeting spec (Meta API pattern)
  if (
    input.placementMode === "manual" &&
    input.publisherPlatforms?.length
  ) {
    targetingSpec.publisher_platforms = input.publisherPlatforms;
    if (input.facebookPositions?.length) {
      targetingSpec.facebook_positions = input.facebookPositions;
    }
    if (input.instagramPositions?.length) {
      targetingSpec.instagram_positions = input.instagramPositions;
    }
  }

  const body: Record<string, string | number | boolean | undefined> = {
    name: input.name,
    campaign_id: input.campaignId,
    optimization_goal: input.optimizationGoal,
    billing_event: "IMPRESSIONS",
    bid_strategy: input.bidStrategy,
    targeting: JSON.stringify(targetingSpec),
    status: "PAUSED",
    start_time: input.startTime,
  };

  if (input.endTime) {
    body.end_time = input.endTime;
  }
  if (input.budgetType === "daily") {
    body.daily_budget = String(input.budgetCents);
  } else {
    body.lifetime_budget = String(input.budgetCents);
  }
  if (input.bidAmountCents !== undefined) {
    body.bid_amount = String(input.bidAmountCents);
  }

  const result = await graphPost<{ id: string }>(
    `${accountId}/adsets`,
    body,
  );

  if (!result.id) {
    throw new Error("Failed to create ad set — no ID returned");
  }

  return { id: result.id };
}
