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

const BRAND_ID = "winespies";

type TimeRange = "today" | "last_7d" | "last_14d" | "last_30d";

const TIME_RANGE_LABELS: Record<TimeRange, string> = {
  today: "Today",
  last_7d: "Last 7 days",
  last_14d: "Last 14 days",
  last_30d: "Last 30 days",
};

type AdSet = {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  campaign_id: string;
  daily_budget?: string;
  lifetime_budget?: string;
  bid_strategy?: string;
  bid_amount?: string;
  insights: MetaInsights | null;
};

type CampaignRef = { id: string; name: string };

type SortKey =
  | "name" | "effective_status" | "campaign" | "budget" | "bid_strategy"
  | "spend" | "revenue" | "roas" | "purchases" | "cpa"
  | "clicks" | "ctr" | "cpc" | "cpm";

function getSortValue(a: AdSet, key: SortKey, campaignMap: Record<string, string>): number | string {
  switch (key) {
    case "name": return a.name.toLowerCase();
    case "effective_status": return a.effective_status;
    case "campaign": return (campaignMap[a.campaign_id] ?? "").toLowerCase();
    case "budget": return getBudget(a);
    case "bid_strategy": return a.bid_strategy ?? "";
    case "spend": return getSpend(a.insights);
    case "revenue": return getRevenue(a.insights);
    case "roas": return getRoas(a.insights);
    case "purchases": return getPurchases(a.insights);
    case "cpa": return getCPA(a.insights);
    case "clicks": return a.insights?.clicks ? parseFloat(a.insights.clicks) : 0;
    case "ctr": return a.insights?.ctr ? parseFloat(a.insights.ctr) : 0;
    case "cpc": return a.insights?.cpc ? parseFloat(a.insights.cpc) : 0;
    case "cpm": return a.insights?.cpm ? parseFloat(a.insights.cpm) : 0;
  }
}

export default function AdSetsPage() {
  const [adsets, setAdsets] = useState<AdSet[]>([]);
  const [campaigns, setCampaigns] = useState<CampaignRef[]>([]);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [timeRange, setTimeRange] = useState<TimeRange>("last_7d");
  const [sortKey, setSortKey] = useState<SortKey>("spend");
  const [sortAsc, setSortAsc] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [minSpend, setMinSpend] = useState<number>(0);
  const [campaignFilter, setCampaignFilter] = useState<string>("");

  // Budget editing
  const [editingBudget, setEditingBudget] = useState<string | null>(null);
  const [budgetInput, setBudgetInput] = useState("");
  const [budgetSaving, setBudgetSaving] = useState(false);

  // Fetch campaigns for name lookup + filter dropdown
  useEffect(() => {
    fetch(`/api/meta-ads/campaigns?brand=${BRAND_ID}&timeRange=${timeRange}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.campaigns) setCampaigns(d.campaigns.map((c: { id: string; name: string }) => ({ id: c.id, name: c.name })));
      })
      .catch(() => {});
  }, [timeRange]);

  const campaignMap: Record<string, string> = {};
  for (const c of campaigns) campaignMap[c.id] = c.name;

  const fetchAdSets = useCallback(async (range: TimeRange, cId?: string) => {
    try {
      let url = `/api/meta-ads/adsets?brand=${BRAND_ID}&timeRange=${range}`;
      if (cId) url += `&campaignId=${cId}`;
      const res = await fetch(url);
      const data = await res.json();
      if (data.error) { setError(data.error); return; }
      setAdsets(data.adsets ?? []);
      setSyncedAt(data.syncedAt ?? null);
      setError(null);
    } catch {
      setError("Failed to load ad sets");
    }
  }, []);

  useEffect(() => {
    fetchAdSets(timeRange, campaignFilter || undefined);
  }, [fetchAdSets, timeRange, campaignFilter]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  // Budget editing
  const startEditBudget = (a: AdSet) => {
    setEditingBudget(a.id);
    setBudgetInput(String(getBudget(a)));
  };

  const cancelEditBudget = () => { setEditingBudget(null); setBudgetInput(""); };

  const saveBudget = async (adsetId: string) => {
    const value = parseFloat(budgetInput);
    if (isNaN(value) || value < 0) return;
    setBudgetSaving(true);
    try {
      const res = await fetch("/api/meta-ads/update-campaign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand: BRAND_ID, campaignId: adsetId, dailyBudget: value }),
      });
      const data = await res.json();
      if (data.ok) {
        setAdsets((prev) =>
          prev.map((a) => a.id === adsetId ? { ...a, daily_budget: String(Math.round(value * 100)) } : a)
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

  // Filtering & sorting
  const filtered = adsets.filter((a) => {
    if (minSpend > 0 && getSpend(a.insights) < minSpend) return false;
    return true;
  });

  const sorted = [...filtered].sort((a, b) => {
    const av = getSortValue(a, sortKey, campaignMap);
    const bv = getSortValue(b, sortKey, campaignMap);
    const cmp = typeof av === "string" ? av.localeCompare(bv as string) : (av as number) - (bv as number);
    return sortAsc ? cmp : -cmp;
  });

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

  const sortArrow = (key: SortKey) => {
    if (sortKey !== key) return "";
    return sortAsc ? " \u25B2" : " \u25BC";
  };

  const columns: { key: SortKey; label: string; align?: "left" | "right" }[] = [
    { key: "name", label: "Ad Set", align: "left" },
    { key: "effective_status", label: "Status", align: "left" },
    { key: "campaign", label: "Campaign", align: "left" },
    { key: "budget", label: "Budget/day", align: "right" },
    { key: "bid_strategy", label: "Bid Strategy", align: "left" },
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

          {/* Campaign filter */}
          <select
            value={campaignFilter}
            onChange={(e) => setCampaignFilter(e.target.value)}
            className="border border-border rounded-md px-3 py-1.5 text-sm bg-surface max-w-[200px]"
          >
            <option value="">All campaigns</option>
            {campaigns.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
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

        <span className="text-xs text-muted">{filtered.length} ad sets</span>
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

      {/* Table */}
      {filtered.length === 0 && !error ? (
        <div className="text-center py-16 text-muted">
          No ad sets found. Sync campaigns first from the Campaigns tab.
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
              {sorted.map((a) => {
                const ins = a.insights;
                const isEditingThisBudget = editingBudget === a.id;

                return (
                  <tr key={a.id} className="border-b border-border last:border-0 hover:bg-accent-light/30 transition-colors">
                    <td className="px-3 py-2 font-medium max-w-[200px] truncate" title={a.name}>{a.name}</td>
                    <td className="px-3 py-2">
                      <span className={`inline-block px-2 py-0.5 rounded text-xs font-medium ${statusColor(a.effective_status)}`}>
                        {a.effective_status}
                      </span>
                    </td>
                    <td className="px-3 py-2 max-w-[180px] truncate text-muted" title={campaignMap[a.campaign_id] ?? a.campaign_id}>
                      {campaignMap[a.campaign_id] ?? a.campaign_id}
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
                              if (e.key === "Enter") saveBudget(a.id);
                              if (e.key === "Escape") cancelEditBudget();
                            }}
                            className="border border-border rounded px-1.5 py-0.5 text-sm w-20 bg-surface tabular-nums text-right"
                            autoFocus
                            disabled={budgetSaving}
                          />
                          <button
                            onClick={() => saveBudget(a.id)}
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
                          onClick={() => startEditBudget(a)}
                          className="hover:text-accent cursor-pointer"
                          title="Click to edit budget"
                        >
                          {fmt$(getBudget(a))}
                        </button>
                      )}
                    </td>
                    <td className="px-3 py-2 text-xs">{a.bid_strategy ?? "—"}</td>
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
