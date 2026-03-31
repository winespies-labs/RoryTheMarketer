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
} from "@/app/ads-manager/lib/insights-helpers";

type SortMetric = "score" | "roas" | "revenue" | "spend" | "purchases" | "cpa";

const SORT_OPTIONS: { key: SortMetric; label: string }[] = [
  { key: "score", label: "Score" },
  { key: "roas", label: "ROAS" },
  { key: "revenue", label: "Revenue" },
  { key: "spend", label: "Spend" },
  { key: "purchases", label: "Purchases" },
  { key: "cpa", label: "CPA" },
];

type Ad = {
  id: string;
  name: string;
  campaign_id: string;
  adset_id: string;
  effective_status: string;
  creative?: {
    id: string;
    thumbnail_url?: string;
    title?: string;
    body?: string;
  };
  insights: MetaInsights | null;
};

function getMetricValue(ins: MetaInsights | null, metric: SortMetric): number {
  switch (metric) {
    case "score": return getAdScore(ins);
    case "roas": return getRoas(ins);
    case "revenue": return getRevenue(ins);
    case "spend": return getSpend(ins);
    case "purchases": return getPurchases(ins);
    case "cpa": return getCPA(ins);
  }
}

type Props = {
  brandId: string;
  timeRange: string;
  accountId?: string | null;
};

export default function TopAdsCards({ brandId, timeRange, accountId }: Props) {
  const [ads, setAds] = useState<Ad[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [sortBy, setSortBy] = useState<SortMetric>("score");

  const fetchAds = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/meta-ads/ads?brand=${brandId}&timeRange=${timeRange}`
      );
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      setAds(data.ads ?? []);
    } catch {
      setError("Failed to load ads");
    } finally {
      setLoading(false);
    }
  }, [brandId, timeRange]);

  useEffect(() => {
    fetchAds();
  }, [fetchAds]);

  if (loading) {
    return (
      <div className="bg-surface border border-border rounded-lg p-8 text-center text-muted">
        Loading top ads...
      </div>
    );
  }

  if (error) {
    return (
      <div className="bg-surface border border-border rounded-lg p-8 text-center text-danger">
        {error}
      </div>
    );
  }

  // Filter to ads with spend > 0, sort by selected metric, take top 5
  const withSpend = ads.filter((a) => getSpend(a.insights) > 0);
  const sorted = [...withSpend].sort(
    (a, b) => getMetricValue(b.insights, sortBy) - getMetricValue(a.insights, sortBy)
  );
  const top5 = sorted.slice(0, 5);

  if (top5.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-lg p-8 text-center text-muted">
        No ads with spend found. Sync from Meta first.
      </div>
    );
  }

  const actId = accountId?.replace("act_", "") ?? "";

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <label className="text-xs text-muted">Sort by:</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as SortMetric)}
            className="border border-border rounded-md px-2 py-1 text-xs bg-surface"
          >
            {SORT_OPTIONS.map((opt) => (
              <option key={opt.key} value={opt.key}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>
        <span className="text-xs text-muted">
          Showing {top5.length} of {withSpend.length} ads
        </span>
      </div>

      {/* Cards grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
        {top5.map((ad, i) => {
          const ins = ad.insights;
          const roas = getRoas(ins);
          const score = getAdScore(ins);

          return (
            <div
              key={ad.id}
              className="bg-surface border border-border rounded-lg overflow-hidden hover:shadow-md transition-shadow"
            >
              {/* Thumbnail */}
              <div className="aspect-square bg-border/20 relative">
                {ad.creative?.thumbnail_url ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={ad.creative.thumbnail_url}
                    alt={ad.name}
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <div className="w-full h-full flex items-center justify-center text-muted text-xs">
                    No preview
                  </div>
                )}
                {/* Rank badge */}
                <div className="absolute top-2 left-2 bg-black/70 text-white text-xs font-bold w-6 h-6 rounded-full flex items-center justify-center">
                  {i + 1}
                </div>
              </div>

              {/* Info */}
              <div className="p-3">
                {/* Ad name */}
                <a
                  href={
                    actId
                      ? `https://www.facebook.com/ads/manager/account/ads?act=${actId}&selected_ad_ids=${ad.id}`
                      : "#"
                  }
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-xs font-medium hover:text-accent truncate block mb-2"
                  title={ad.name}
                >
                  {ad.name}
                </a>

                {/* Metrics */}
                <div className="space-y-1 text-xs">
                  <div className="flex justify-between">
                    <span className="text-muted">Score</span>
                    <span className="font-medium tabular-nums">{fmtNum(score, 1)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Spend</span>
                    <span className="font-medium tabular-nums">{fmt$(getSpend(ins))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Revenue</span>
                    <span className="font-medium tabular-nums">{fmt$(getRevenue(ins))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">ROAS</span>
                    <span
                      className={`font-medium tabular-nums ${roas >= 2 ? "text-success" : ""}`}
                    >
                      {fmtNum(roas, 2)}x
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">Purchases</span>
                    <span className="font-medium tabular-nums">{fmtNum(getPurchases(ins))}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-muted">CPA</span>
                    <span className="font-medium tabular-nums">{fmt$(getCPA(ins))}</span>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
