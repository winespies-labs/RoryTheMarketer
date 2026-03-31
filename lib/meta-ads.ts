// ── Types & constants for Meta Ads Manager (Phase 6A) ──

export const META_CAMPAIGNS_FILENAME = "meta-campaigns.json";
export const META_ADSETS_FILENAME = "meta-adsets.json";
export const META_ADS_FILENAME = "meta-ads.json";

export const TIME_RANGES = ["today", "last_7d", "last_14d", "last_30d"] as const;
export type TimeRange = (typeof TIME_RANGES)[number];

export const DEFAULT_TIME_RANGES: TimeRange[] = ["today", "last_7d", "last_14d", "last_30d"];

/** Convert a TimeRange key to a `{ since, until }` pair (YYYY-MM-DD). */
export function timeRangeToDates(range: TimeRange): { since: string; until: string } {
  const now = new Date();
  const fmt = (d: Date) => d.toISOString().slice(0, 10);
  const today = fmt(now);

  switch (range) {
    case "today":
      return { since: today, until: today };
    case "last_7d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 6);
      return { since: fmt(d), until: today };
    }
    case "last_14d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 13);
      return { since: fmt(d), until: today };
    }
    case "last_30d": {
      const d = new Date(now);
      d.setDate(d.getDate() - 29);
      return { since: fmt(d), until: today };
    }
  }
}

// ── Insights ──

export type MetaActionValue = {
  action_type: string;
  value: string;
};

export type MetaInsights = {
  spend?: string;
  impressions?: string;
  clicks?: string;
  cpc?: string;
  cpm?: string;
  ctr?: string;
  actions?: MetaActionValue[];
  action_values?: MetaActionValue[];
  cost_per_action_type?: MetaActionValue[];
};

// ── Entities ──

export type MetaCampaign = {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  objective?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  created_time?: string;
  updated_time?: string;
  insights?: Partial<Record<TimeRange, MetaInsights | null>>;
};

export type MetaAdSet = {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  campaign_id: string;
  objective?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  bid_strategy?: string;
  bid_amount?: string;
  created_time?: string;
  updated_time?: string;
  insights?: Partial<Record<TimeRange, MetaInsights | null>>;
};

export type MetaAdCreative = {
  id: string;
  thumbnail_url?: string;
  title?: string;
  body?: string;
  image_url?: string;
};

export type MetaAd = {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  adset_id: string;
  campaign_id: string;
  creative?: MetaAdCreative;
  created_time?: string;
  updated_time?: string;
  insights?: Partial<Record<TimeRange, MetaInsights | null>>;
};

// ── Storage wrappers ──

export type MetaCampaignsData = {
  syncedAt: string;
  accountId: string;
  timeRanges: TimeRange[];
  campaigns: MetaCampaign[];
};

export type MetaAdSetsData = {
  syncedAt: string;
  accountId: string;
  timeRanges: TimeRange[];
  adsets: MetaAdSet[];
};

export type MetaAdsData = {
  syncedAt: string;
  accountId: string;
  timeRanges: TimeRange[];
  ads: MetaAd[];
};
