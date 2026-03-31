"use client";

import { useCallback, useEffect, useState } from "react";
import type { MetaInsights } from "@/lib/meta-ads";
import {
  getRevenue,
  getPurchases,
  getSpend,
  getRoas,
  getCPA,
  getBudget,
  fmt$,
  fmtNum,
  fmtPct,
  statusColor,
} from "@/app/ads-manager/lib/insights-helpers";
import MetricsChart from "@/app/ads-manager/components/MetricsChart";
import TopAdsCards from "@/app/ads-manager/components/TopAdsCards";

const BRAND_ID = "winespies";

type TimeRange = "today" | "last_7d" | "last_14d" | "last_30d";

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  today: "Today",
  last_7d: "Last 7 days",
  last_14d: "Last 14 days",
  last_30d: "Last 30 days",
};

type Campaign = {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  objective?: string;
  daily_budget?: string;
  lifetime_budget?: string;
  insights: MetaInsights | null;
};

type SortKey =
  | "name" | "effective_status" | "budget" | "spend" | "revenue"
  | "roas" | "purchases" | "cpa" | "clicks" | "ctr" | "cpc" | "cpm";

type ViewTab = "chart" | "cards";

function getSortValue(c: Campaign, key: SortKey): number | string {
  switch (key) {
    case "name": return c.name.toLowerCase();
    case "effective_status": return c.effective_status;
    case "budget": return getBudget(c);
    case "spend": return getSpend(c.insights);
    case "revenue": return getRevenue(c.insights);
    case "roas": return getRoas(c.insights);
    case "purchases": return getPurchases(c.insights);
    case "cpa": return getCPA(c.insights);
    case "clicks": return c.insights?.clicks ? parseFloat(c.insights.clicks) : 0;
    case "ctr": return c.insights?.ctr ? parseFloat(c.insights.ctr) : 0;
    case "cpc": return c.insights?.cpc ? parseFloat(c.insights.cpc) : 0;
    case "cpm": return c.insights?.cpm ? parseFloat(c.insights.cpm) : 0;
  }
}

// ── Component ──

export default function CampaignsPage() {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [accountId, setAccountId] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>("last_7d");
  const [syncing, setSyncing] = useState(false);
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [sortAsc, setSortAsc] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [viewTab, setViewTab] = useState<ViewTab>("chart");
  const [minSpend, setMinSpend] = useState<number>(0);

  // Budget editing
  const [editingBudget, setEditingBudget] = useState<string | null>(null);
  const [budgetInput, setBudgetInput] = useState("");
  const [budgetSaving, setBudgetSaving] = useState(false);

  const fetchCampaigns = useCallback(async (range: TimeRange) => {
    try {
      const res = await fetch(`/api/meta-ads/campaigns?brand=${BRAND_ID}&timeRange=${range}`);
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      setCampaigns(data.campaigns ?? []);
      setSyncedAt(data.syncedAt ?? null);
      setAccountId(data.accountId ?? null);
      setError(null);
    } catch {
      setError("Failed to load campaigns");
    }
  }, []);

  useEffect(() => {
    fetchCampaigns(timeRange);
  }, [fetchCampaigns, timeRange]);

  const handleSync = async () => {
    setSyncing(true);
    setError(null);
    try {
      const res = await fetch("/api/meta-ads/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand: BRAND_ID }),
      });
      const data = await res.json();
      if (!data.ok) {
        setError(data.error ?? "Sync failed");
      } else {
        await fetchCampaigns(timeRange);
      }
    } catch {
      setError("Sync request failed");
    } finally {
      setSyncing(false);
    }
  };

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortAsc(!sortAsc);
    } else {
      setSortKey(key);
      setSortAsc(false);
    }
  };

  // ── Budget editing ──

  const startEditBudget = (c: Campaign) => {
    setEditingBudget(c.id);
    setBudgetInput(String(getBudget(c)));
  };

  const cancelEditBudget = () => {
    setEditingBudget(null);
    setBudgetInput("");
  };

  const saveBudget = async (campaignId: string) => {
    const value = parseFloat(budgetInput);
    if (isNaN(value) || value < 0) return;

    setBudgetSaving(true);
    try {
      const res = await fetch("/api/meta-ads/update-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand: BRAND_ID, campaignId, dailyBudget: value }),
      });
      const data = await res.json();
      if (data.ok) {
        // Update local state to reflect new budget
        setCampaigns((prev) =>
          prev.map((c) =>
            c.id === campaignId
              ? { ...c, daily_budget: String(Math.round(value * 100)) }
              : c
          )
        );
        cancelEditBudget();
      } else {
        setError(data.error ?? "Failed to update budget");
      }
    } catch {
      setError("Failed to update budget");
    } finally {
      setBudgetSaving(false);
    }
  };

  // ── Filtering & sorting ──

  const filtered = campaigns.filter((c) => {
    if (minSpend > 0 && getSpend(c.insights) < minSpend) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const av = getSortValue(a, sortKey);
    const bv = getSortValue(b, sortKey);
    const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
    return sortAsc ? cmp : -cmp;
  });

  // ── Aggregated KPIs (from filtered campaigns) ──
  const totalSpend = filtered.reduce((s, c) => s + getSpend(c.insights), 0);
  const totalRevenue = filtered.reduce((s, c) => s + getRevenue(c.insights), 0);
  const totalPurchases = filtered.reduce((s, c) => s + getPurchases(c.insights), 0);
  const totalClicks = filtered.reduce((s, c) => s + (c.insights?.clicks ? parseFloat(c.insights.clicks) : 0), 0);
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

  const sortArrow = (key: SortKey) => {
    if (sortKey !== key) return "";
    return sortAsc ? " \u25B2" : " \u25BC";
  };

  const columns: { key: SortKey; label: string; align?: "left" | "right" }[] = [
    { key: "name", label: "Campaign", align: "left" },
    { key: "effective_status", label: "Status", align: "left" },
    { key: "budget", label: "Budget/day", align: "right" },
    { key: "spend", label: "Spend", align: "right" },
    { key: "revenue", label: "Revenue", align: "right" },
    { key: "roas", label: "ROAS", align: "right" },
    { key: "purchases", label: "Purchases", align: "right" },
    { key: "cpa", label: "CPA", align: "right" },
    { key: "clicks", label: "Clicks", align: "right" },
    { key: "ctr", label: "CTR", align: "right" },
    { key: "cpc", label: "CPC", align: "right" },
    { key: "cpm", label: "CPM", align: "right" },
  ];

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

          {/* Min Spend filter */}
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

        <button
          onClick={handleSync}
          disabled={syncing}
          className="px-4 py-1.5 text-sm font-medium bg-accent text-white rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {syncing ? "Syncing..." : "Sync from Meta"}
        </button>
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

      {/* Chart | Cards toggle */}
      <div className="flex items-center justify-between mb-4">
        <div className="flex rounded-lg border border-border overflow-hidden">
          <button
            onClick={() => setViewTab("chart")}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              viewTab === "chart"
                ? "bg-accent text-white"
                : "bg-surface text-muted hover:text-foreground"
            }`}
          >
            Chart
          </button>
          <button
            onClick={() => setViewTab("cards")}
            className={`px-4 py-1.5 text-sm font-medium transition-colors ${
              viewTab === "cards"
                ? "bg-accent text-white"
                : "bg-surface text-muted hover:text-foreground"
            }`}
          >
            Cards
          </button>
        </div>

        {minSpend > 0 && (
          <span className="text-xs text-muted">
            {filtered.length} of {campaigns.length} campaigns (min ${minSpend} spend)
          </span>
        )}
      </div>

      {/* View content */}
      <div className="mb-6">
        {viewTab === "chart" ? (
          <MetricsChart brandId={BRAND_ID} timeRange={timeRange} />
        ) : (
          <TopAdsCards brandId={BRAND_ID} timeRange={timeRange} accountId={accountId} />
        )}
      </div>

      {/* Table */}
      {filtered.length === 0 && !error ? (
        <div className="text-center py-16 text-muted">
          No campaigns yet. Click &ldquo;Sync from Meta&rdquo; to pull your ad data.
        </div>
      ) : (
        <div className="border border-border rounded-lg overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-surface">
                {columns.map((col) => (
                  <th
                    key={col.key}
                    onClick={() => handleSort(col.key)}
                    className={`px-3 py-2 font-medium cursor-pointer select-none whitespace-nowrap ${
                      col.align === "right" ? "text-right" : "text-left"
                    } ${sortKey === col.key ? "text-accent" : "text-muted"}`}
                  >
                    {col.label}{sortArrow(col.key)}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {sorted.map((c) => {
                const ins = c.insights;
                const isEditingThisBudget = editingBudget === c.id;

                return (
                  <tr key={c.id} className="border-b border-border last:border-0 hover:bg-accent-light/30 transition-colors">
                    <td className="px-3 py-2 font-medium max-w-[240px] truncate" title={c.name}>{c.name}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColor(c.effective_status)}`}>
                        {c.effective_status}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">
                      {isEditingThisBudget ? (
                        <span className="inline-flex items-center gap-1">
                          <input
                            type="number"
                            min={0}
                            step={1}
                            value={budgetInput}
                            onChange={(e) => setBudgetInput(e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveBudget(c.id);
                              if (e.key === "Escape") cancelEditBudget();
                            }}
                            className="border border-border rounded px-1.5 py-0.5 text-sm w-20 bg-surface tabular-nums text-right"
                            autoFocus
                            disabled={budgetSaving}
                          />
                          <button
                            onClick={() => saveBudget(c.id)}
                            disabled={budgetSaving}
                            className="text-success hover:text-success/80 text-xs font-bold"
                            title="Save"
                          >
                            {budgetSaving ? "..." : "OK"}
                          </button>
                          <button
                            onClick={cancelEditBudget}
                            className="text-muted hover:text-foreground text-xs"
                            title="Cancel"
                          >
                            X
                          </button>
                        </span>
                      ) : (
                        <button
                          onClick={() => startEditBudget(c)}
                          className="hover:text-accent cursor-pointer"
                          title="Click to edit budget"
                        >
                          {fmt$(getBudget(c))}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt$(getSpend(ins))}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt$(getRevenue(ins))}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtNum(getRoas(ins), 2)}x</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtNum(getPurchases(ins))}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt$(getCPA(ins))}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtNum(ins?.clicks ? parseFloat(ins.clicks) : 0)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmtPct(ins?.ctr ? parseFloat(ins.ctr) : 0)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt$(ins?.cpc ? parseFloat(ins.cpc) : 0)}</td>
                    <td className="px-3 py-2 text-right tabular-nums">{fmt$(ins?.cpm ? parseFloat(ins.cpm) : 0)}</td>
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
