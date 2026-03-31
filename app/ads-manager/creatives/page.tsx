"use client";

import { useCallback, useEffect, useState } from "react";
import type { MetaInsights } from "@/lib/meta-ads";
import {
  getRevenue,
  getPurchases,
  getSpend,
  getRoas,
  getCPA,
  getAdScore,
  fmt$,
  fmtNum,
  statusColor,
} from "@/app/ads-manager/lib/insights-helpers";

const BRAND_ID = "winespies";

type TimeRange = "today" | "last_7d" | "last_14d" | "last_30d";

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  today: "Today",
  last_7d: "Last 7 days",
  last_14d: "Last 14 days",
  last_30d: "Last 30 days",
};

type Ad = {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  adset_id: string;
  campaign_id: string;
  creative?: {
    id: string;
    thumbnail_url?: string;
    title?: string;
    body?: string;
    image_url?: string;
  };
  insights: MetaInsights | null;
};

type SortKey = "score" | "roas" | "revenue" | "spend" | "purchases" | "cpa";
type ViewMode = "grid" | "table";

const SORT_OPTIONS: { value: SortKey; label: string }[] = [
  { value: "score", label: "Score" },
  { value: "roas", label: "ROAS" },
  { value: "revenue", label: "Revenue" },
  { value: "spend", label: "Spend" },
  { value: "purchases", label: "Purchases" },
  { value: "cpa", label: "CPA" },
];

function getSortValue(ad: Ad, key: SortKey): number {
  switch (key) {
    case "score": return getAdScore(ad.insights);
    case "roas": return getRoas(ad.insights);
    case "revenue": return getRevenue(ad.insights);
    case "spend": return getSpend(ad.insights);
    case "purchases": return getPurchases(ad.insights);
    case "cpa": return getCPA(ad.insights);
  }
}

export default function CreativesPage() {
  const [ads, setAds] = useState<Ad[]>([]);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>("last_7d");
  const [sortKey, setSortKey] = useState<SortKey>("score");
  const [minSpend, setMinSpend] = useState<number>(0);
  const [viewMode, setViewMode] = useState<ViewMode>("grid");
  const [error, setError] = useState<string | null>(null);

  const fetchAds = useCallback(async (range: TimeRange) => {
    try {
      const res = await fetch(`/api/meta-ads/ads?brand=${BRAND_ID}&timeRange=${range}`);
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setAds(data.ads ?? []);
      setSyncedAt(data.syncedAt ?? null);
      setAccountId(data.accountId ?? null);
      setError(null);
    } catch {
      setError("Failed to load ads");
    }
  }, []);

  useEffect(() => {
    fetchAds(timeRange);
  }, [fetchAds, timeRange]);

  // Filtering & sorting
  const filtered = ads.filter((a) => {
    if (minSpend > 0 && getSpend(a.insights) < minSpend) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => getSortValue(b, sortKey) - getSortValue(a, sortKey));

  // KPIs
  const totalSpend = filtered.reduce((s, a) => s + getSpend(a.insights), 0);
  const totalRevenue = filtered.reduce((s, a) => s + getRevenue(a.insights), 0);
  const totalPurchases = filtered.reduce((s, a) => s + getPurchases(a.insights), 0);
  const totalClicks = filtered.reduce((s, a) => s + (a.insights?.clicks ? parseFloat(a.insights.clicks) : 0), 0);
  const overallRoas = totalSpend > 0 ? totalRevenue / totalSpend : 0;
  const overallCpa = totalPurchases > 0 ? totalSpend / totalPurchases : 0;

  const kpis = [
    { label: "Spend", value: fmt$(totalSpend) },
    { label: "Revenue", value: fmt$(totalRevenue) },
    { label: "ROAS", value: fmtNum(overallRoas, 2) + "x" },
    { label: "Purchases", value: fmtNum(totalPurchases) },
    { label: "CPA", value: fmt$(overallCpa) },
    { label: "Clicks", value: fmtNum(totalClicks) },
  ];

  const adsManagerUrl = (adId: string) =>
    accountId
      ? `https://www.facebook.com/ads/manager/account/ads?act=${accountId.replace("act_", "")}&selected_ad_ids=${adId}`
      : "#";

  return (
    <div>
      {/* Controls */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <select
            value={timeRange}
            onChange={(e) => setTimeRange(e.target.value as TimeRange)}
            className="border border-border rounded-md px-3 py-1.5 text-sm bg-surface"
          >
            {(Object.entries(TIME_RANGE_LABELS) as [TimeRange, string][]).map(([k, v]) => (
              <option key={k} value={k}>{v}</option>
            ))}
          </select>

          <select
            value={sortKey}
            onChange={(e) => setSortKey(e.target.value as SortKey)}
            className="border border-border rounded-md px-3 py-1.5 text-sm bg-surface"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>Sort: {opt.label}</option>
            ))}
          </select>

          <div className="flex items-center gap-1.5">
            <label className="text-xs text-muted whitespace-nowrap">Min spend:</label>
            <input
              type="number"
              min={0}
              step={1}
              value={minSpend || ""}
              placeholder="$0"
              onChange={(e) => setMinSpend(parseFloat(e.target.value) || 0)}
              className="border border-border rounded-md px-2 py-1.5 text-sm bg-surface w-20 tabular-nums"
            />
          </div>

          {syncedAt && (
            <span className="text-xs text-muted">
              Last sync: {new Date(syncedAt).toLocaleString()}
            </span>
          )}
        </div>

        <div className="flex items-center gap-3">
          <span className="text-xs text-muted">{filtered.length} ads</span>
          <div className="flex rounded-lg border border-border overflow-hidden">
            <button
              onClick={() => setViewMode("grid")}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === "grid" ? "bg-accent text-white" : "bg-surface text-muted hover:text-foreground"
              }`}
            >
              Grid
            </button>
            <button
              onClick={() => setViewMode("table")}
              className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                viewMode === "table" ? "bg-accent text-white" : "bg-surface text-muted hover:text-foreground"
              }`}
            >
              Table
            </button>
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 px-4 py-2 bg-danger/10 text-danger text-sm rounded-md">{error}</div>
      )}

      {/* KPI Cards */}
      <div className="grid grid-cols-6 gap-3 mb-6">
        {kpis.map((kpi) => (
          <div key={kpi.label} className="bg-surface border border-border rounded-lg px-4 py-3">
            <div className="text-xs text-muted mb-1">{kpi.label}</div>
            <div className="text-lg font-semibold">{kpi.value}</div>
          </div>
        ))}
      </div>

      {/* Content */}
      {filtered.length === 0 && !error ? (
        <div className="text-center py-16 text-muted">
          No ads found. Sync campaigns first from the Campaigns tab.
        </div>
      ) : viewMode === "grid" ? (
        /* Grid View */
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
          {sorted.map((ad) => {
            const ins = ad.insights;
            const thumb = ad.creative?.thumbnail_url || ad.creative?.image_url;

            return (
              <a
                key={ad.id}
                href={adsManagerUrl(ad.id)}
                target="_blank"
                rel="noopener noreferrer"
                className="bg-surface border border-border rounded-lg overflow-hidden hover:border-accent transition-colors group"
              >
                <div className="aspect-square bg-border/30 relative">
                  {thumb ? (
                    <img src={thumb} alt={ad.name} className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-muted text-xs">No image</div>
                  )}
                  <span className={`absolute top-2 left-2 inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColor(ad.effective_status)}`}>
                    {ad.effective_status}
                  </span>
                </div>
                <div className="p-3">
                  <div className="text-sm font-medium truncate mb-2 group-hover:text-accent transition-colors" title={ad.name}>
                    {ad.name}
                  </div>
                  <div className="grid grid-cols-2 gap-x-3 gap-y-1 text-xs">
                    <div>
                      <span className="text-muted">Spend </span>
                      <span className="tabular-nums">{fmt$(getSpend(ins))}</span>
                    </div>
                    <div>
                      <span className="text-muted">Rev </span>
                      <span className="tabular-nums">{fmt$(getRevenue(ins))}</span>
                    </div>
                    <div>
                      <span className="text-muted">ROAS </span>
                      <span className="tabular-nums">{fmtNum(getRoas(ins), 2)}x</span>
                    </div>
                    <div>
                      <span className="text-muted">Purch </span>
                      <span className="tabular-nums">{fmtNum(getPurchases(ins))}</span>
                    </div>
                  </div>
                </div>
              </a>
            );
          })}
        </div>
      ) : (
        /* Table View */
        <div className="border border-border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                <th className="px-3 py-2 text-left font-medium text-muted w-10"></th>
                <th className="px-3 py-2 text-left font-medium text-muted">Name</th>
                <th className="px-3 py-2 text-left font-medium text-muted">Status</th>
                <th className="px-3 py-2 text-right font-medium text-muted">Score</th>
                <th className="px-3 py-2 text-right font-medium text-muted">Spend</th>
                <th className="px-3 py-2 text-right font-medium text-muted">Revenue</th>
                <th className="px-3 py-2 text-right font-medium text-muted">ROAS</th>
                <th className="px-3 py-2 text-right font-medium text-muted">Purchases</th>
                <th className="px-3 py-2 text-right font-medium text-muted">CPA</th>
                <th className="px-3 py-2 text-right font-medium text-muted">Clicks</th>
              </tr>
            </thead>
            <tbody>
              {sorted.map((ad) => {
                const ins = ad.insights;
                const thumb = ad.creative?.thumbnail_url || ad.creative?.image_url;

                return (
                  <tr key={ad.id} className="border-b border-border last:border-0 hover:bg-accent-light/30 transition-colors">
                    <td className="px-3 py-2">
                      {thumb ? (
                        <img src={thumb} alt="" className="w-10 h-10 rounded object-cover" />
                      ) : (
                        <div className="w-10 h-10 rounded bg-border/30" />
                      )}
                    </td>
                    <td className="px-3 py-2 font-medium max-w-[200px] truncate">
                      <a
                        href={adsManagerUrl(ad.id)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="hover:text-accent transition-colors"
                        title={ad.name}
                      >
                        {ad.name}
                      </a>
                    </td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColor(ad.effective_status)}`}>
                        {ad.effective_status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtNum(getAdScore(ins), 2)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt$(getSpend(ins))}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt$(getRevenue(ins))}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtNum(getRoas(ins), 2)}x</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtNum(getPurchases(ins))}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt$(getCPA(ins))}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtNum(ins?.clicks ? parseFloat(ins.clicks) : 0)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
