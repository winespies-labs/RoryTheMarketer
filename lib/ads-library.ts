/**
 * Meta Ad Library (ads_archive) API.
 * See https://developers.facebook.com/docs/graph-api/reference/ads_archive/
 * Uses META_ACCESS_TOKEN (same as Graph API).
 */

export interface AdsLibraryAd {
  id: string;
  ad_snapshot_url?: string;
  ad_creative_bodies?: string[];
  ad_creative_link_titles?: string[];
  page_name?: string;
  page_id?: string;
  ad_delivery_start_time?: string;
  ad_delivery_stop_time?: string;
  bylines?: string;
  [key: string]: unknown;
}

export interface AdsLibrarySearchParams {
  searchTerms: string;
  adReachedCountries?: string[];
  adType?: "ALL" | "POLITICAL_AND_ISSUE_ADS" | "EMPLOYMENT_ADS" | "HOUSING_ADS" | "FINANCIAL_PRODUCTS_AND_SERVICES_ADS";
  limit?: number;
}

const FIELDS = [
  "id",
  "ad_snapshot_url",
  "ad_creative_bodies",
  "ad_creative_link_titles",
  "page_name",
  "page_id",
  "ad_delivery_start_time",
  "ad_delivery_stop_time",
  "bylines",
].join(",");

function getAccessToken(): string {
  const token = process.env.META_ACCESS_TOKEN;
  if (!token) throw new Error("META_ACCESS_TOKEN is not set");
  return token;
}

/**
 * Search Meta Ad Library. Returns normalized list of ads.
 * ad_reached_countries is required by Meta; default ["US"].
 */
export async function searchAdsArchive(params: AdsLibrarySearchParams): Promise<AdsLibraryAd[]> {
  const countries = params.adReachedCountries?.length
    ? params.adReachedCountries
    : ["US"];
  const adType = params.adType ?? "ALL";
  const limit = Math.min(params.limit ?? 100, 500);

  const token = getAccessToken();
  const searchParams = new URLSearchParams({
    access_token: token,
    search_terms: params.searchTerms,
    ad_reached_countries: JSON.stringify(countries),
    ad_type: adType,
    fields: FIELDS,
    limit: String(limit),
  });

  const url = `https://graph.facebook.com/v21.0/ads_archive?${searchParams.toString()}`;
  const res = await fetch(url);
  const json = (await res.json()) as { data?: AdsLibraryAd[]; error?: { message?: string } };
  if (!res.ok) {
    const msg = json?.error?.message ?? `Ads Library API error ${res.status}`;
    if (res.status === 429) throw new Error("Meta rate limit exceeded; try again later.");
    throw new Error(msg);
  }
  const data = json?.data ?? [];
  return Array.isArray(data) ? data : [];
}
