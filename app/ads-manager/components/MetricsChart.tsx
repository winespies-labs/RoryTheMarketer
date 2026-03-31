"use client";

import { useCallback, useEffect, useState } from "react";
import {
  ResponsiveContainer,
  ComposedChart,
  Area,
  Line,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
} from "recharts";
import type { DailyInsight } from "@/app/api/meta-ads/insights-daily/route";
import { fmt$, fmtNum } from "@/app/ads-manager/lib/insights-helpers";

type MetricKey = "spend" | "revenue" | "roas" | "purchases" | "cpa";

const METRICS: { key: MetricKey; label: string; color: string; yAxisId: string }[] = [
  { key: "spend", label: "Spend", color: "#6366f1", yAxisId: "left" },
  { key: "revenue", label: "Revenue", color: "#10b981", yAxisId: "left" },
  { key: "roas", label: "ROAS", color: "#f59e0b", yAxisId: "right" },
  { key: "purchases", label: "Purchases", color: "#8b5cf6", yAxisId: "left" },
  { key: "cpa", label: "CPA", color: "#ef4444", yAxisId: "left" },
];

function formatDate(dateStr: string): string {
  const d = new Date(dateStr + "T00:00:00");
  return d.toLocaleDateString("en-US", { month: "short", day: "numeric" });
}

function formatMetricValue(key: MetricKey, value: number): string {
  switch (key) {
    case "spend":
    case "revenue":
    case "cpa":
      return fmt$(value);
    case "roas":
      return fmtNum(value, 2) + "x";
    case "purchases":
      return fmtNum(value);
  }
}

type Props = {
  brandId: string;
  timeRange: string;
};

export default function MetricsChart({ brandId, timeRange }: Props) {
  const [days, setDays] = useState<DailyInsight[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeMetrics, setActiveMetrics] = useState<Set<MetricKey>>(
    new Set(["spend", "revenue", "roas"])
  );

  const fetchDaily = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(
        `/api/meta-ads/insights-daily?brand=${brandId}&timeRange=${timeRange}`
      );
      const data = await res.json();
      if (data.error) {
        setError(data.error);
        return;
      }
      setDays(data.days ?? []);
    } catch {
      setError("Failed to load daily insights");
    } finally {
      setLoading(false);
    }
  }, [brandId, timeRange]);

  useEffect(() => {
    fetchDaily();
  }, [fetchDaily]);

  const toggleMetric = (key: MetricKey) => {
    setActiveMetrics((prev) => {
      const next = new Set(prev);
      if (next.has(key)) {
        if (next.size > 1) next.delete(key);
      } else {
        next.add(key);
      }
      return next;
    });
  };

  if (loading) {
    return (
      <div className="bg-surface border border-border rounded-lg p-8 text-center text-muted">
        Loading chart data...
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

  if (days.length === 0) {
    return (
      <div className="bg-surface border border-border rounded-lg p-8 text-center text-muted">
        No daily data available. Sync from Meta first.
      </div>
    );
  }

  const hasRightAxis = activeMetrics.has("roas");

  return (
    <div className="bg-surface border border-border rounded-lg p-4">
      {/* Metric toggles */}
      <div className="flex flex-wrap gap-2 mb-4">
        {METRICS.map((m) => (
          <button
            key={m.key}
            onClick={() => toggleMetric(m.key)}
            className={`px-3 py-1 text-xs font-medium rounded-full border transition-colors ${
              activeMetrics.has(m.key)
                ? "border-transparent text-white"
                : "border-border text-muted hover:text-foreground"
            }`}
            style={
              activeMetrics.has(m.key) ? { backgroundColor: m.color } : undefined
            }
          >
            {m.label}
          </button>
        ))}
      </div>

      {/* Chart */}
      <ResponsiveContainer width="100%" height={320}>
        <ComposedChart data={days} margin={{ top: 5, right: 10, left: 10, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-border, #e5e7eb)" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDate}
            tick={{ fontSize: 11, fill: "var(--color-muted, #9ca3af)" }}
            axisLine={false}
            tickLine={false}
          />
          <YAxis
            yAxisId="left"
            tick={{ fontSize: 11, fill: "var(--color-muted, #9ca3af)" }}
            axisLine={false}
            tickLine={false}
            tickFormatter={(v: number) => {
              if (v >= 1000) return `$${(v / 1000).toFixed(0)}k`;
              return `$${v}`;
            }}
          />
          {hasRightAxis && (
            <YAxis
              yAxisId="right"
              orientation="right"
              tick={{ fontSize: 11, fill: "var(--color-muted, #9ca3af)" }}
              axisLine={false}
              tickLine={false}
              tickFormatter={(v: number) => `${v.toFixed(1)}x`}
            />
          )}
          <Tooltip
            contentStyle={{
              backgroundColor: "var(--color-surface, #fff)",
              border: "1px solid var(--color-border, #e5e7eb)",
              borderRadius: "8px",
              fontSize: "12px",
            }}
            labelFormatter={(label) => formatDate(String(label))}
            formatter={(value, name) => {
              const metric = METRICS.find((m) => m.key === name);
              return [formatMetricValue(metric?.key ?? "spend", Number(value)), metric?.label ?? String(name)];
            }}
          />

          {activeMetrics.has("spend") && (
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="spend"
              stroke="#6366f1"
              fill="#6366f1"
              fillOpacity={0.1}
              strokeWidth={2}
            />
          )}
          {activeMetrics.has("revenue") && (
            <Area
              yAxisId="left"
              type="monotone"
              dataKey="revenue"
              stroke="#10b981"
              fill="#10b981"
              fillOpacity={0.1}
              strokeWidth={2}
            />
          )}
          {activeMetrics.has("roas") && (
            <Line
              yAxisId="right"
              type="monotone"
              dataKey="roas"
              stroke="#f59e0b"
              strokeWidth={2}
              dot={false}
            />
          )}
          {activeMetrics.has("purchases") && (
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="purchases"
              stroke="#8b5cf6"
              strokeWidth={2}
              dot={false}
            />
          )}
          {activeMetrics.has("cpa") && (
            <Line
              yAxisId="left"
              type="monotone"
              dataKey="cpa"
              stroke="#ef4444"
              strokeWidth={2}
              dot={false}
            />
          )}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}
