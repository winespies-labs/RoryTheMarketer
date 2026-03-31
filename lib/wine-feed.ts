const FEED_URL = "https://winespies.com/sales/current.json";
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

let cached: { data: unknown[]; fetchedAt: number } | null = null;

/**
 * Fetch current wines from the Wine Spies feed.
 * Caches for 5 minutes. Shared between API routes to avoid
 * self-referencing fetch (which fails on Railway/container deployments).
 */
export async function fetchCurrentWines(): Promise<unknown[]> {
  if (cached && Date.now() - cached.fetchedAt < CACHE_TTL_MS) {
    return cached.data;
  }

  const res = await fetch(FEED_URL, { next: { revalidate: 300 } });
  if (!res.ok) {
    throw new Error(`Wine feed returned ${res.status}`);
  }
  const data = await res.json();
  if (!Array.isArray(data)) {
    throw new Error("Unexpected wines response — expected array");
  }
  cached = { data, fetchedAt: Date.now() };
  return data;
}
