import { getPrisma } from "./prisma";
import type { MetaCampaign, MetaAdSet, MetaAd, MetaCampaignsData, MetaAdSetsData } from "./meta-ads";

// ── Campaigns ──

export async function upsertCampaigns(
  brandId: string,
  accountId: string,
  campaigns: MetaCampaign[],
  syncedAt: Date,
) {
  const prisma = getPrisma();
  await prisma.$transaction(
    campaigns.map((c) =>
      prisma.metaCampaignSnapshot.upsert({
        where: {
          brandId_metaCampaignId: { brandId, metaCampaignId: c.id },
        },
        update: {
          accountId,
          name: c.name,
          status: c.status,
          effectiveStatus: c.effective_status,
          objective: c.objective ?? null,
          dailyBudget: c.daily_budget ?? null,
          lifetimeBudget: c.lifetime_budget ?? null,
          insights: c.insights ? (c.insights as object) : undefined,
          syncedAt,
        },
        create: {
          brandId,
          metaCampaignId: c.id,
          accountId,
          name: c.name,
          status: c.status,
          effectiveStatus: c.effective_status,
          objective: c.objective ?? null,
          dailyBudget: c.daily_budget ?? null,
          lifetimeBudget: c.lifetime_budget ?? null,
          insights: c.insights ? (c.insights as object) : undefined,
          syncedAt,
        },
      }),
    ),
  );
}

// ── Ad Sets ──

export async function upsertAdSets(
  brandId: string,
  accountId: string,
  adsets: MetaAdSet[],
  syncedAt: Date,
) {
  const prisma = getPrisma();
  await prisma.$transaction(
    adsets.map((a) =>
      prisma.metaAdSetSnapshot.upsert({
        where: {
          brandId_metaAdSetId: { brandId, metaAdSetId: a.id },
        },
        update: {
          accountId,
          campaignId: a.campaign_id,
          name: a.name,
          status: a.status,
          effectiveStatus: a.effective_status,
          dailyBudget: a.daily_budget ?? null,
          lifetimeBudget: a.lifetime_budget ?? null,
          bidStrategy: a.bid_strategy ?? null,
          bidAmount: a.bid_amount ?? null,
          insights: a.insights ? (a.insights as object) : undefined,
          syncedAt,
        },
        create: {
          brandId,
          metaAdSetId: a.id,
          accountId,
          campaignId: a.campaign_id,
          name: a.name,
          status: a.status,
          effectiveStatus: a.effective_status,
          dailyBudget: a.daily_budget ?? null,
          lifetimeBudget: a.lifetime_budget ?? null,
          bidStrategy: a.bid_strategy ?? null,
          bidAmount: a.bid_amount ?? null,
          insights: a.insights ? (a.insights as object) : undefined,
          syncedAt,
        },
      }),
    ),
  );
}

// ── Ads ──

export async function upsertAds(
  brandId: string,
  accountId: string,
  ads: MetaAd[],
  syncedAt: Date,
) {
  const prisma = getPrisma();
  await prisma.$transaction(
    ads.map((a) =>
      prisma.metaAdSnapshot.upsert({
        where: {
          brandId_metaAdId: { brandId, metaAdId: a.id },
        },
        update: {
          accountId,
          adsetId: a.adset_id,
          campaignId: a.campaign_id,
          name: a.name,
          status: a.status,
          effectiveStatus: a.effective_status,
          creative: a.creative ? (a.creative as object) : undefined,
          insights: a.insights ? (a.insights as object) : undefined,
          syncedAt,
        },
        create: {
          brandId,
          metaAdId: a.id,
          accountId,
          adsetId: a.adset_id,
          campaignId: a.campaign_id,
          name: a.name,
          status: a.status,
          effectiveStatus: a.effective_status,
          creative: a.creative ? (a.creative as object) : undefined,
          insights: a.insights ? (a.insights as object) : undefined,
          syncedAt,
        },
      }),
    ),
  );
}

// ── Daily Insights ──

export interface DailyInsightRow {
  date: string;
  spend: number;
  revenue: number;
  roas: number;
  purchases: number;
  cpa: number;
  clicks: number;
  impressions: number;
  ctr: number;
  cpc: number;
  cpm: number;
}

export async function upsertDailyInsights(
  brandId: string,
  accountId: string,
  days: DailyInsightRow[],
) {
  const prisma = getPrisma();
  const now = new Date();
  await prisma.$transaction(
    days.map((d) =>
      prisma.metaDailyInsight.upsert({
        where: {
          brandId_date: { brandId, date: d.date },
        },
        update: {
          accountId,
          spend: d.spend,
          revenue: d.revenue,
          roas: d.roas,
          purchases: d.purchases,
          cpa: d.cpa,
          clicks: d.clicks,
          impressions: d.impressions,
          ctr: d.ctr,
          cpc: d.cpc,
          cpm: d.cpm,
          fetchedAt: now,
        },
        create: {
          brandId,
          accountId,
          date: d.date,
          spend: d.spend,
          revenue: d.revenue,
          roas: d.roas,
          purchases: d.purchases,
          cpa: d.cpa,
          clicks: d.clicks,
          impressions: d.impressions,
          ctr: d.ctr,
          cpc: d.cpc,
          cpm: d.cpm,
          fetchedAt: now,
        },
      }),
    ),
  );
}

export async function queryDailyInsights(
  brandId: string,
  since: string,
  until: string,
): Promise<DailyInsightRow[]> {
  const prisma = getPrisma();
  const rows = await prisma.metaDailyInsight.findMany({
    where: {
      brandId,
      date: { gte: since, lte: until },
    },
    orderBy: { date: "asc" },
  });
  return rows.map((r) => ({
    date: r.date,
    spend: r.spend,
    revenue: r.revenue,
    roas: r.roas,
    purchases: r.purchases,
    cpa: r.cpa,
    clicks: r.clicks,
    impressions: r.impressions,
    ctr: r.ctr,
    cpc: r.cpc,
    cpm: r.cpm,
  }));
}

// ── Sync Log ──

export async function logSync(
  brandId: string,
  syncType: "full" | "daily",
  status: "success" | "error",
  counts?: { campaigns?: number; adsets?: number; ads?: number; days?: number },
  error?: string,
) {
  const prisma = getPrisma();
  await prisma.metaSyncLog.create({
    data: {
      brandId,
      syncType,
      status,
      campaignCount: counts?.campaigns ?? null,
      adsetCount: counts?.adsets ?? null,
      adCount: counts?.ads ?? null,
      daysCount: counts?.days ?? null,
      error: error ?? null,
      completedAt: new Date(),
    },
  });
}

// ── Read snapshots from DB (used when filesystem is unavailable, e.g. Railway) ──

export async function readCampaignsFromDB(brandId: string): Promise<MetaCampaignsData | null> {
  const prisma = getPrisma();
  const rows = await prisma.metaCampaignSnapshot.findMany({
    where: { brandId },
    orderBy: { syncedAt: "desc" },
  });
  if (rows.length === 0) return null;

  const syncedAt = rows[0].syncedAt.toISOString();
  const accountId = rows[0].accountId;

  const campaigns: MetaCampaign[] = rows.map((r) => ({
    id: r.metaCampaignId,
    name: r.name,
    status: r.status,
    effective_status: r.effectiveStatus,
    objective: r.objective ?? undefined,
    daily_budget: r.dailyBudget ?? undefined,
    lifetime_budget: r.lifetimeBudget ?? undefined,
    insights: r.insights as MetaCampaign["insights"] ?? undefined,
  }));

  return { syncedAt, accountId, timeRanges: [], campaigns };
}

export async function readAdSetsFromDB(brandId: string): Promise<MetaAdSetsData | null> {
  const prisma = getPrisma();
  const rows = await prisma.metaAdSetSnapshot.findMany({
    where: { brandId },
    orderBy: { syncedAt: "desc" },
  });
  if (rows.length === 0) return null;

  const syncedAt = rows[0].syncedAt.toISOString();
  const accountId = rows[0].accountId;

  const adsets: MetaAdSet[] = rows.map((r) => ({
    id: r.metaAdSetId,
    name: r.name,
    status: r.status,
    effective_status: r.effectiveStatus,
    campaign_id: r.campaignId,
    daily_budget: r.dailyBudget ?? undefined,
    lifetime_budget: r.lifetimeBudget ?? undefined,
    bid_strategy: r.bidStrategy ?? undefined,
    bid_amount: r.bidAmount ?? undefined,
    insights: r.insights as MetaAdSet["insights"] ?? undefined,
  }));

  return { syncedAt, accountId, timeRanges: [], adsets };
}
