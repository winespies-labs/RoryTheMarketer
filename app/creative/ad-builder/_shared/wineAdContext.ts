/**
 * wineAdContext.ts
 * Resolves raw Wine Spies feed records into clean WineAdContext objects.
 * Consumed by the PDP Ad Builder at feed load time — not at generation time.
 */

// ── Raw Feed Types ───────────────────────────────────────────────────────────

export interface RawSale {
  id: number;
  codename: string;
  price: { value: string; cents: number };
  retail: { value: string; cents: number };
  brief: string;
  mini_brief: string;
  award_name: string;
  qty_remaining: number;
  "sold_out?": boolean;
  composite_bottle_image_urls: {
    url: string;
    large_3x?: { url: string };
    small?: { url: string };
  };
  bottle_image_urls: {
    url: string;
    large_3x?: { url: string };
    small?: { url: string };
  };
  channel: { name: string; key: string };
  product: {
    id: number;
    name: string;
    vintage: string;
    abv: number | null;
    vineyard: string | null;
    stats: string;
    producers_description: string;
    region: { display_name: string };
    varietal: {
      name: string;
      classification: { name: string };
    };
    producer: { name: string };
    form_factor: { name: string; volume: number };
  };
}

// ── Resolved Context ─────────────────────────────────────────────────────────

export type VarietalClassification =
  | "red"
  | "white"
  | "rosé"
  | "sparkling"
  | "dessert"
  | "other";

export interface WineAdContext {
  sale_id: number;
  codename: string;
  sale_url: string;

  display_name: string;
  producer: string;
  wine_name: string;
  vintage: string;

  sale_price_cents: number;
  retail_price_cents: number;
  sale_price: string;
  retail_price: string;
  savings: string;
  savings_cents: number;
  discount_pct: number;

  has_score: boolean;
  score: number | null;
  score_label: string | null;

  varietal: string;
  varietal_classification: VarietalClassification;
  appellation: string;
  region: string;
  vineyard: string | null;
  abv: number | null;

  channel: "featured" | "store";
  channel_name: string;

  qty_remaining: number;
  sold_out: boolean;

  composite_image_url: string;
  bottle_image_url: string;

  brief: string;
  mini_brief: string;
  mini_brief_plain: string;

  _raw: RawSale;
}

// ── Private helpers ──────────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/\r?\n/g, " ")
    .trim();
}

function parseScore(awardName: string): { has_score: boolean; score: number | null; score_label: string | null } {
  if (!awardName?.trim()) return { has_score: false, score: null, score_label: null };
  const match = awardName.match(/^(\d{2,3})\s*(?:pts?\.?|points?)\s*[-–—]\s*(.+)$/i);
  if (match) {
    const score = parseInt(match[1], 10);
    if (score >= 80 && score <= 100) {
      return { has_score: true, score, score_label: match[2].trim() };
    }
  }
  return { has_score: false, score: null, score_label: null };
}

function parseScoreFromText(text: string): { has_score: boolean; score: number | null; score_label: string | null } {
  const match = text.match(/(\d{2,3})\s*(?:pts?\.?|points?)\s*[-–—]\s*([A-Za-z][^\n,\.]{2,40})/i);
  if (!match) return { has_score: false, score: null, score_label: null };
  const score = parseInt(match[1], 10);
  if (score < 80 || score > 100) return { has_score: false, score: null, score_label: null };
  return { has_score: true, score, score_label: match[2].trim() };
}

function mapClassification(raw: string): VarietalClassification {
  const s = raw.toLowerCase();
  if (s.includes("red")) return "red";
  if (s.includes("white")) return "white";
  if (s.includes("ros")) return "rosé";
  if (s.includes("sparkling") || s.includes("champagne") || s.includes("prosecco") || s.includes("cava")) return "sparkling";
  if (s.includes("dessert") || s.includes("port") || s.includes("sweet") || s.includes("late harvest")) return "dessert";
  return "other";
}

// ── Public API ───────────────────────────────────────────────────────────────

/**
 * Normalize one raw feed record into a clean WineAdContext.
 * Call at feed load time — not at generation time.
 */
export function resolveWineAdContext(sale: RawSale): WineAdContext {
  // Score: try award_name first, then fall back to scanning brief text
  let scoreResult = parseScore(sale.award_name ?? "");
  if (!scoreResult.has_score) {
    scoreResult = parseScoreFromText(stripHtml(sale.brief ?? ""));
  }
  const { has_score, score, score_label } = scoreResult;

  const retailCents = sale.retail?.cents ?? 0;
  const saleCents = sale.price?.cents ?? 0;
  const savingsCents = Math.max(0, retailCents - saleCents);
  const discountPct = retailCents > 0 ? Math.round((savingsCents / retailCents) * 100) : 0;

  const compositeUrl =
    sale.composite_bottle_image_urls?.large_3x?.url ??
    sale.composite_bottle_image_urls?.url ??
    sale.bottle_image_urls?.large_3x?.url ??
    sale.bottle_image_urls?.url ??
    "";

  const bottleUrl =
    sale.bottle_image_urls?.large_3x?.url ??
    sale.bottle_image_urls?.url ??
    compositeUrl;

  const vintage = sale.product?.vintage ?? "";
  const producer = sale.product?.producer?.name ?? "";
  const wineName = sale.product?.name ?? "";
  const displayName = [vintage, producer, wineName].filter(Boolean).join(" ");

  const channelKey = sale.channel?.key ?? "";
  const channel: "featured" | "store" = channelKey === "featured" ? "featured" : "store";

  const miniHtml = sale.mini_brief ?? "";

  return {
    sale_id: sale.id,
    codename: sale.codename,
    sale_url: `https://winespies.com/sales/${encodeURIComponent(sale.codename)}`,
    display_name: displayName,
    producer,
    wine_name: wineName,
    vintage,
    sale_price_cents: saleCents,
    retail_price_cents: retailCents,
    sale_price: "$" + (saleCents / 100).toFixed(0),
    retail_price: "$" + (retailCents / 100).toFixed(0),
    savings: "$" + (savingsCents / 100).toFixed(0),
    savings_cents: savingsCents,
    discount_pct: discountPct,
    has_score,
    score,
    score_label,
    varietal: sale.product?.varietal?.name ?? "",
    varietal_classification: mapClassification(sale.product?.varietal?.classification?.name ?? ""),
    appellation: sale.product?.region?.display_name ?? "",
    region: sale.product?.region?.display_name ?? "",
    vineyard: sale.product?.vineyard ?? null,
    abv: sale.product?.abv ?? null,
    channel,
    channel_name: sale.channel?.name ?? "",
    qty_remaining: sale.qty_remaining ?? 0,
    sold_out: sale["sold_out?"] ?? false,
    composite_image_url: compositeUrl,
    bottle_image_url: bottleUrl,
    brief: sale.brief ?? "",
    mini_brief: miniHtml,
    mini_brief_plain: stripHtml(miniHtml).slice(0, 400),
    _raw: sale,
  };
}
