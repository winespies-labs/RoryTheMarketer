/**
 * Foreplay Public API client.
 * See https://public.api.foreplay.co/docs
 * Env: FOREPLAY_API_KEY
 */

const BASE_URL = "https://public.api.foreplay.co";

export interface ForeplayAd {
  id: string;
  domain?: string;
  headline?: string;
  body?: string;
  imageUrl?: string;
  videoUrl?: string;
  platform?: string;
  pageName?: string;
  createdAt?: string;
  [key: string]: unknown;
}

export interface ForeplaySearchParams {
  domains?: string[];
  searchTerms?: string[];
  limit?: number;
}

function getApiKey(): string {
  const key = process.env.FOREPLAY_API_KEY;
  if (!key?.trim()) throw new Error("FOREPLAY_API_KEY is not set");
  return key.trim();
}

async function request<T>(
  path: string,
  options: RequestInit & { params?: Record<string, string> } = {}
): Promise<T> {
  const { params, ...init } = options;
  const url = new URL(path, BASE_URL);
  if (params) {
    Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  }
  const res = await fetch(url.toString(), {
    ...init,
    headers: {
      Authorization: `Bearer ${getApiKey()}`,
      "Content-Type": "application/json",
      ...init.headers,
    },
  });
  if (!res.ok) {
    const text = await res.text();
    if (res.status === 429) throw new Error("Foreplay rate limit exceeded; try again later.");
    throw new Error(`Foreplay API error ${res.status}: ${text || res.statusText}`);
  }
  return res.json() as Promise<T>;
}

/**
 * Discovery: search ads by domain or keywords.
 * Foreplay discovery endpoints may vary; this normalizes to ForeplayAd[].
 */
export async function searchAds(params: ForeplaySearchParams): Promise<ForeplayAd[]> {
  const terms = [
    ...(params.domains ?? []),
    ...(params.searchTerms ?? []),
  ].filter(Boolean);
  if (terms.length === 0) return [];

  const limit = Math.min(params.limit ?? 50, 100);
  const collected: ForeplayAd[] = [];
  const seen = new Set<string>();

  for (const term of terms.slice(0, 5)) {
    try {
      const data = await request<{ data?: unknown[]; ads?: unknown[]; results?: unknown[] }>(
        "/v1/ads/search",
        {
          params: {
            query: term,
            limit: String(limit),
          },
        }
      );
      const list = Array.isArray(data?.data) ? data.data : Array.isArray(data?.ads) ? data.ads : Array.isArray(data?.results) ? data.results : [];
      for (const raw of list) {
        const ad = normalizeForeplayAd(raw, term);
        if (ad && !seen.has(ad.id)) {
          seen.add(ad.id);
          collected.push(ad);
        }
      }
    } catch (e) {
      if (String(e).includes("404") || String(e).includes("endpoint")) {
        const fallback = await searchAdsFallback(term, limit);
        for (const ad of fallback) {
          if (!seen.has(ad.id)) {
            seen.add(ad.id);
            collected.push(ad);
          }
        }
      } else throw e;
    }
  }

  return collected;
}

/**
 * Fallback: try alternative Foreplay discovery endpoint (e.g. by domain).
 */
async function searchAdsFallback(term: string, limit: number): Promise<ForeplayAd[]> {
  const data = await request<{ data?: unknown[]; ads?: unknown[] }>(
    "/v1/discovery",
    {
      params: {
        domain: term.includes(".") ? term : "",
        keyword: term.includes(".") ? "" : term,
        limit: String(limit),
      },
    }
  );
  const list = Array.isArray(data?.data) ? data.data : Array.isArray(data?.ads) ? data.ads : [];
  return list.map((raw) => normalizeForeplayAd(raw, term)).filter(Boolean) as ForeplayAd[];
}

function normalizeForeplayAd(raw: unknown, contextTerm?: string): ForeplayAd | null {
  if (!raw || typeof raw !== "object") return null;
  const o = raw as Record<string, unknown>;
  const id = [o.id, o.ad_id, o.adId].find((v) => typeof v === "string") as string | undefined;
  if (!id) return null;
  return {
    id: String(id),
    domain: (o.domain as string) ?? contextTerm,
    headline: [o.headline, o.title, o.primary_text].find((v) => typeof v === "string") as string | undefined,
    body: [o.body, o.description, o.body_text, o.copy].find((v) => typeof v === "string") as string | undefined,
    imageUrl: [o.imageUrl, o.image_url, o.thumbnail_url, o.thumbnail].find((v) => typeof v === "string") as string | undefined,
    videoUrl: [o.videoUrl, o.video_url, o.video].find((v) => typeof v === "string") as string | undefined,
    platform: typeof o.platform === "string" ? o.platform : undefined,
    pageName: typeof o.page_name === "string" ? o.page_name : (o.pageName as string),
    createdAt: typeof o.created_at === "string" ? o.created_at : (o.createdAt as string),
    ...o,
  };
}

export interface ForeplaySyncResult {
  syncedAt: string;
  ads: ForeplayAd[];
}
