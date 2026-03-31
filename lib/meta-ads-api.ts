import { graphGetAllPages } from "@/lib/meta-graph";
import { getAdAccountId } from "@/lib/meta-marketing";
import {
  type TimeRange,
  type MetaCampaign,
  type MetaAdSet,
  type MetaAd,
  type MetaInsights,
  timeRangeToDates,
  DEFAULT_TIME_RANGES,
} from "@/lib/meta-ads";

// ── Shared ──

const INSIGHTS_FIELDS = [
  "spend",
  "impressions",
  "clicks",
  "cpc",
  "cpm",
  "ctr",
  "actions",
  "action_values",
  "cost_per_action_type",
].join(",");

function insightsFieldExpansion(range: TimeRange): string {
  const { since, until } = timeRangeToDates(range);
  return `insights.time_range({"since":"${since}","until":"${until}"}).fields(${INSIGHTS_FIELDS})`;
}

/** Extract inline insights data from a Graph API entity response. */
function extractInsights(entity: Record<string, unknown>): MetaInsights | null {
  const ins = entity.insights as { data?: MetaInsights[] } | undefined;
  if (!ins?.data?.[0]) return null;
  return ins.data[0];
}

// ── Generic fetcher with multi-range merge ──

type EntityWithId = { id: string; insights?: Record<string, MetaInsights | null> };

async function fetchEntitiesWithInsights<T extends EntityWithId>(
  accountId: string,
  edge: string,
  entityFields: string,
  timeRanges: TimeRange[],
): Promise<T[]> {
  const ranges = timeRanges.length > 0 ? timeRanges : DEFAULT_TIME_RANGES;
  const primaryRange = ranges[0];

  // First call: full entity fields + primary range insights
  const primaryFields = `${entityFields},${insightsFieldExpansion(primaryRange)}`;
  const rawEntities = await graphGetAllPages<Record<string, unknown>>(
    `/${accountId}/${edge}`,
    { fields: primaryFields, limit: 50 },
    { maxItems: 500 },
  );

  // Build map keyed by id
  const map = new Map<string, T>();
  for (const raw of rawEntities) {
    const entity = { ...raw } as unknown as T;
    const primaryInsights = extractInsights(raw);
    entity.insights = { [primaryRange]: primaryInsights } as Record<string, MetaInsights | null>;
    map.set(entity.id, entity);
  }

  // Subsequent ranges: fetch id + insights only, merge
  for (const range of ranges.slice(1)) {
    const fields = `id,${insightsFieldExpansion(range)}`;
    const rows = await graphGetAllPages<Record<string, unknown>>(
      `/${accountId}/${edge}`,
      { fields, limit: 50 },
      { maxItems: 500 },
    );
    for (const row of rows) {
      const id = row.id as string;
      const existing = map.get(id);
      if (existing) {
        existing.insights![range] = extractInsights(row);
      }
    }
  }

  return Array.from(map.values());
}

// ── Public API ──

const CAMPAIGN_FIELDS = [
  "id", "name", "status", "effective_status", "objective",
  "daily_budget", "lifetime_budget", "created_time", "updated_time",
].join(",");

export async function fetchCampaigns(
  brandId: string,
  timeRanges: TimeRange[] = DEFAULT_TIME_RANGES,
): Promise<MetaCampaign[]> {
  const accountId = getAdAccountId(brandId);
  return fetchEntitiesWithInsights<MetaCampaign>(accountId, "campaigns", CAMPAIGN_FIELDS, timeRanges);
}

const ADSET_FIELDS = [
  "id", "name", "status", "effective_status", "campaign_id",
  "daily_budget", "lifetime_budget", "bid_strategy", "bid_amount",
  "created_time", "updated_time",
].join(",");

export async function fetchAdSets(
  brandId: string,
  timeRanges: TimeRange[] = DEFAULT_TIME_RANGES,
): Promise<MetaAdSet[]> {
  const accountId = getAdAccountId(brandId);
  return fetchEntitiesWithInsights<MetaAdSet>(accountId, "adsets", ADSET_FIELDS, timeRanges);
}

const AD_FIELDS = [
  "id", "name", "status", "effective_status", "adset_id", "campaign_id",
  "creative{id,thumbnail_url,title,body,image_url}",
  "created_time", "updated_time",
].join(",");

export async function fetchAds(
  brandId: string,
  timeRanges: TimeRange[] = DEFAULT_TIME_RANGES,
): Promise<MetaAd[]> {
  const accountId = getAdAccountId(brandId);
  return fetchEntitiesWithInsights<MetaAd>(accountId, "ads", AD_FIELDS, timeRanges);
}
