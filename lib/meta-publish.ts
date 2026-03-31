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

  const result = await graphPost<{ id: string }>(
    `${accountId}/adcreatives`,
    {
      name: input.name,
      object_story_spec: objectStorySpec,
    },
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
