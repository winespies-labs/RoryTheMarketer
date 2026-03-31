import type { MetaInsights, MetaActionValue } from "@/lib/meta-ads";

// ── Value extractors ──

export function actionValue(actions: MetaActionValue[] | undefined, type: string): number {
  if (!actions) return 0;
  const found = actions.find((a) => a.action_type === type);
  return found ? parseFloat(found.value) || 0 : 0;
}

export function getRevenue(ins: MetaInsights | null): number {
  if (!ins) return 0;
  let rev = actionValue(ins.action_values, "purchase");
  if (!rev) rev = actionValue(ins.action_values, "offsite_conversion.fb_pixel_purchase");
  return rev;
}

export function getPurchases(ins: MetaInsights | null): number {
  if (!ins) return 0;
  let p = actionValue(ins.actions, "purchase");
  if (!p) p = actionValue(ins.actions, "offsite_conversion.fb_pixel_purchase");
  return p;
}

export function getSpend(ins: MetaInsights | null): number {
  return ins?.spend ? parseFloat(ins.spend) : 0;
}

export function getCPA(ins: MetaInsights | null): number {
  const purchases = getPurchases(ins);
  if (!purchases) return 0;
  return getSpend(ins) / purchases;
}

export function getRoas(ins: MetaInsights | null): number {
  const spend = getSpend(ins);
  if (!spend) return 0;
  return getRevenue(ins) / spend;
}

// ── Campaign-level helpers ──

export type CampaignLike = {
  daily_budget?: string;
  lifetime_budget?: string;
};

export function getBudget(c: CampaignLike): number {
  const raw = c.daily_budget ?? c.lifetime_budget ?? "0";
  return (parseFloat(raw) || 0) / 100;
}

// ── Formatters ──

export function fmt$(n: number): string {
  return n.toLocaleString("en-US", { style: "currency", currency: "USD", minimumFractionDigits: 2 });
}

export function fmtNum(n: number, decimals = 0): string {
  return n.toLocaleString("en-US", { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
}

export function fmtPct(n: number): string {
  return parseFloat(String(n)).toFixed(2) + "%";
}

export function statusColor(status: string): string {
  switch (status) {
    case "ACTIVE": return "bg-success/15 text-success";
    case "PAUSED": return "bg-yellow-100 text-yellow-700";
    default: return "bg-border/50 text-muted";
  }
}

// ── Score: rewards both ROAS and volume ──

export function getAdScore(ins: MetaInsights | null): number {
  const roas = getRoas(ins);
  const purchases = getPurchases(ins);
  return roas * Math.log10(purchases + 1);
}
