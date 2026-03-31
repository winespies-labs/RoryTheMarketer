/**
 * TemplateProduct — the normalized product shape consumed by HTML ad templates.
 *
 * Converted from the WineSale shape returned by /api/wines/current.
 */

export interface TemplateProduct {
  id: string;
  name: string;
  producer: string;
  varietal: string;
  varietal_short: string;
  region: string;
  vintage: number;
  score: number;
  score_source: string;
  score_source_abbrev: string;
  critic_quote: string;
  our_copy: string;
  price_retail: number;
  price_sale: number;
  savings: number;
  discount_pct: number;
  promo_code: string | null;
  cta: string;
  background_prompt: string;
  bottle_image_url?: string;
}

// ── Score source abbreviation lookup ──

const SCORE_SOURCE_ABBREV: Record<string, string> = {
  "wine spectator": "WS",
  "robert parker": "RP",
  "wine advocate": "RP",
  "james suckling": "JS",
  "jeb dunnuck": "JD",
  "wine enthusiast": "WE",
  "decanter": "DC",
  "vinous": "V",
  "antonio galloni": "AG",
};

function abbreviateScoreSource(source: string): string {
  const key = source.toLowerCase().trim();
  for (const [pattern, abbrev] of Object.entries(SCORE_SOURCE_ABBREV)) {
    if (key.includes(pattern)) return abbrev;
  }
  return source.split(/\s+/).map(w => w[0]?.toUpperCase()).join("").slice(0, 3) || "";
}

// ── WineSale shape (mirrors the type in app/ad-builder/page.tsx) ──

interface WineSale {
  id: number;
  price: { value: string; cents: number };
  retail: { value: string; cents: number };
  codename: string;
  brief: string;
  mini_brief: string;
  award_name: string;
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
  product: {
    id: number;
    name: string;
    vintage: string;
    abv: number;
    vineyard: string | null;
    stats: string;
    producers_description: string;
    region: { display_name: string };
    varietal: { name: string; classification: { name: string } };
    producer: { name: string };
    form_factor: { name: string; volume: number };
  };
}

// ── Helpers ──

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/\r?\n/g, " ")
    .trim();
}

function extractScore(awardName: string): { score: number; source: string } {
  // e.g. "98 Points - James Suckling" or "94 pts Wine Spectator"
  const match = awardName.match(/(\d{2,3})\s*(?:points?|pts?)?\s*[-–—]?\s*(.*)/i);
  if (match) {
    return {
      score: parseInt(match[1], 10),
      source: match[2]?.trim() || "Critics",
    };
  }
  return { score: 0, source: "" };
}

function bestBottleUrl(sale: WineSale): string {
  return (
    sale.composite_bottle_image_urls?.large_3x?.url ??
    sale.composite_bottle_image_urls?.url ??
    sale.bottle_image_urls?.large_3x?.url ??
    sale.bottle_image_urls?.url ??
    ""
  );
}

// ── Converter ──

export function wineApiToTemplateProduct(
  sale: WineSale,
  overrides?: Partial<TemplateProduct>,
): TemplateProduct {
  const retailDollars = parseFloat(sale.retail.value);
  const saleDollars = parseFloat(sale.price.value);
  const { score, source } = extractScore(sale.award_name);
  const varietal = sale.product.varietal.name;
  const varietalShort = varietal.split(/\s+/)[0];

  const savings = Math.round(retailDollars - saleDollars);
  const discount_pct = retailDollars > 0
    ? Math.round((savings / retailDollars) * 100)
    : 0;

  const base: TemplateProduct = {
    id: sale.codename || `wine-${sale.id}`,
    name: sale.product.name,
    producer: sale.product.producer.name,
    varietal,
    varietal_short: varietalShort,
    region: sale.product.region.display_name,
    vintage: parseInt(sale.product.vintage, 10) || 0,
    score,
    score_source: source,
    score_source_abbrev: abbreviateScoreSource(source),
    critic_quote: stripHtml(sale.mini_brief).slice(0, 220),
    our_copy: stripHtml(sale.brief).slice(0, 300),
    price_retail: retailDollars,
    price_sale: saleDollars,
    savings,
    discount_pct,
    promo_code: null,
    cta: "GET THIS DEAL",
    background_prompt: `Dramatic dark wine photography background with deep red atmospheric elements, featuring a ${varietal} wine bottle`,
    bottle_image_url: bestBottleUrl(sale) || undefined,
  };

  return { ...base, ...overrides };
}
