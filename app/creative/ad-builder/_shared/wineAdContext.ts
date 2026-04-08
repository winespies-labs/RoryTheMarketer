/**
 * wineAdContext.ts
 * Data foundation for the PDP Ad Builder.
 *
 * All generation pipelines consume WineAdContext — never raw RawSale objects.
 * resolveWineAdContext() runs at feed load time, not at generation time.
 */

// ── Raw Feed Types ──────────────────────────────────────────────────────────

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

// ── Resolved Context ────────────────────────────────────────────────────────

export type VarietalClassification =
  | "red"
  | "white"
  | "rosé"
  | "sparkling"
  | "dessert"
  | "other";

export interface WineAdContext {
  // Identity
  sale_id: number;
  codename: string;
  sale_url: string;

  // Display
  display_name: string; // "2022 Heir Apparent Rutherford Cabernet Sauvignon"
  producer: string;
  wine_name: string;
  vintage: string;

  // Pricing
  sale_price_cents: number;
  retail_price_cents: number;
  sale_price: string; // "$39"
  retail_price: string; // "$165"
  savings: string; // "$126"
  savings_cents: number;
  discount_pct: number; // 76

  // Score — has_score controls badge rendering; never default to fake value
  has_score: boolean;
  score: number | null;
  score_label: string | null; // "Wine Spectator"

  // Taxonomy
  varietal: string;
  varietal_classification: VarietalClassification;
  appellation: string;
  region: string;
  vineyard: string | null;
  abv: number | null;

  // Channel
  channel: "featured" | "store";
  channel_name: string;

  // Availability
  qty_remaining: number;
  sold_out: boolean;

  // Media
  composite_image_url: string;
  bottle_image_url: string;

  // Content
  brief: string;
  mini_brief: string;
  mini_brief_plain: string; // HTML stripped

  // Feed reference
  _raw: RawSale;
}

// ── Template Schema Types ───────────────────────────────────────────────────

export type FieldSource = "feed" | "ai_copy" | "ai_image" | "static";
export type FieldStatus =
  | "ok"
  | "missing_optional"
  | "missing_required"
  | "ai_generated"
  | "static";

export interface FieldDefinition {
  source: FieldSource;
  required: boolean;
  fallback?: "hide_element";
  default?: string;
  description?: string;
  /** Human-readable label shown in Review Brief */
  label?: string;
}

export interface TemplateSchema {
  id: string;
  name: string;
  /** Badge type shown on template card */
  type: string;
  /** Thumbnail image path (relative to public/) */
  thumbnail?: string;
  fields: Record<string, FieldDefinition>;
}

// ── Mapping Result Types ────────────────────────────────────────────────────

export interface FieldMappingResult {
  field: string;
  label: string;
  source: FieldSource;
  status: FieldStatus;
  value: string | null;
  /** True for feed-sourced fields — user can override inline */
  editable: boolean;
}

export interface TemplateMappingResult {
  /** "${sale_id}:${template_id}" */
  mapping_key: string;
  sale_id: number;
  template_id: string;
  context: WineAdContext;
  template: TemplateSchema;
  fields: FieldMappingResult[];
  ready: boolean;
  blocked: boolean;
  blocked_reasons: string[];
}

export interface BatchMappingResult {
  mappings: TemplateMappingResult[];
  ready_count: number;
  blocked_count: number;
  total: number;
}

// ── Template Registry ───────────────────────────────────────────────────────

export const TEMPLATE_SCHEMAS: Record<string, TemplateSchema> = {
  "cult-dark": {
    id: "cult-dark",
    name: "Cult Dark",
    type: "pdp",
    fields: {
      wine_display_name: {
        source: "feed",
        required: true,
        label: "Wine Name",
        description: "Full display name (vintage + producer + wine)",
      },
      sale_price: {
        source: "feed",
        required: true,
        label: "Sale Price",
      },
      retail_price: {
        source: "feed",
        required: true,
        label: "Retail Price",
      },
      savings: {
        source: "feed",
        required: true,
        label: "Savings Amount",
      },
      discount_pct: {
        source: "feed",
        required: true,
        label: "Discount %",
      },
      score_badge: {
        source: "feed",
        required: false,
        fallback: "hide_element",
        label: "Score Badge",
        description: "Critic score number — hidden if no score",
      },
      score_label: {
        source: "feed",
        required: false,
        fallback: "hide_element",
        label: "Score Source",
        description: "Publication name (e.g. Wine Spectator) — hidden if no score",
      },
      score_quote: {
        source: "feed",
        required: false,
        fallback: "hide_element",
        label: "Score Quote",
        description: "Critic review excerpt — hidden if unavailable",
      },
      headline: {
        source: "ai_copy",
        required: true,
        label: "Headline",
      },
      primary_text: {
        source: "ai_copy",
        required: true,
        label: "Primary Text",
      },
      description: {
        source: "ai_copy",
        required: false,
        label: "Description",
      },
      background_image: {
        source: "ai_image",
        required: true,
        label: "Background Image",
        description: "AI-generated via Gemini",
      },
      cta_button: {
        source: "static",
        required: true,
        default: "Secure This Deal →",
        label: "CTA Button",
      },
      logo: {
        source: "static",
        required: true,
        default: "Wine Spies",
        label: "Logo",
      },
    },
  },
};

// ── Resolver Functions ──────────────────────────────────────────────────────

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/\r?\n/g, " ")
    .trim();
}

function parseScoreFromText(text: string): {
  has_score: boolean;
  score: number | null;
  score_label: string | null;
} {
  const match = text.match(
    /(\d{2,3})\s*(?:pts?\.?|points?)\s*[-–—]\s*([A-Za-z][^\n,\.]{2,40})/i
  );
  if (!match) return { has_score: false, score: null, score_label: null };
  const score = parseInt(match[1], 10);
  if (score < 80 || score > 100)
    return { has_score: false, score: null, score_label: null };
  return { has_score: true, score, score_label: match[2].trim() };
}

function parseScore(awardName: string): {
  has_score: boolean;
  score: number | null;
  score_label: string | null;
} {
  if (!awardName?.trim()) {
    return { has_score: false, score: null, score_label: null };
  }
  // e.g. "97 Points - Wine Spectator" or "98 pts – Vinous"
  const match = awardName.match(
    /^(\d{2,3})\s*(?:pts?\.?|points?)\s*[-–—]\s*(.+)$/i
  );
  if (match) {
    const score = parseInt(match[1], 10);
    const label = match[2].trim();
    if (score >= 80 && score <= 100) {
      return { has_score: true, score, score_label: label };
    }
  }
  return { has_score: false, score: null, score_label: null };
}

function mapClassification(raw: string): VarietalClassification {
  const s = raw.toLowerCase();
  if (s.includes("red")) return "red";
  if (s.includes("white")) return "white";
  if (s.includes("ros")) return "rosé";
  if (
    s.includes("sparkling") ||
    s.includes("champagne") ||
    s.includes("prosecco") ||
    s.includes("cava")
  )
    return "sparkling";
  if (
    s.includes("dessert") ||
    s.includes("port") ||
    s.includes("sweet") ||
    s.includes("late harvest")
  )
    return "dessert";
  return "other";
}

/**
 * Normalize one raw feed record into a clean WineAdContext.
 * Call at feed load time — not at generation time.
 */
export function resolveWineAdContext(sale: RawSale): WineAdContext {
  let scoreResult = parseScore(sale.award_name ?? "");
  if (!scoreResult.has_score) {
    scoreResult = parseScoreFromText(stripHtml(sale.brief ?? ""));
  }
  const { has_score, score, score_label } = scoreResult;

  const retailCents = sale.retail?.cents ?? 0;
  const saleCents = sale.price?.cents ?? 0;
  const savingsCents = Math.max(0, retailCents - saleCents);
  const discountPct =
    retailCents > 0 ? Math.round((savingsCents / retailCents) * 100) : 0;

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

  const classificationRaw =
    sale.product?.varietal?.classification?.name ?? "";

  const channelKey = sale.channel?.key ?? "";
  const channel: "featured" | "store" =
    channelKey === "featured" ? "featured" : "store";

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
    varietal_classification: mapClassification(classificationRaw),
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

/**
 * Resolve the field mapping for one wine × template combination.
 * Returns per-field status for the Review Brief step.
 */
export function resolveTemplateFields(
  context: WineAdContext,
  schema: TemplateSchema
): TemplateMappingResult {
  // Feed field value map — add new feed fields here as templates require them
  const feedValues: Record<string, string | null> = {
    wine_display_name: context.display_name || null,
    sale_price: context.sale_price || null,
    retail_price: context.retail_price || null,
    savings: context.savings || null,
    discount_pct: context.discount_pct ? `${context.discount_pct}%` : null,
    score_badge: context.has_score && context.score != null
      ? String(context.score)
      : null,
    score_label: context.has_score ? context.score_label : null,
    score_quote: null, // not directly in feed; always hidden
    bottle_image_url: context.composite_image_url || null,
    producer: context.producer || null,
    varietal: context.varietal || null,
    appellation: context.appellation || null,
    vintage: context.vintage || null,
    vineyard: context.vineyard,
    abv: context.abv != null ? `${context.abv}%` : null,
  };

  const fields: FieldMappingResult[] = Object.entries(schema.fields).map(
    ([fieldKey, def]) => {
      const label = def.label ?? fieldKey;

      if (def.source === "static") {
        return {
          field: fieldKey,
          label,
          source: def.source,
          status: "static" as FieldStatus,
          value: def.default ?? null,
          editable: false,
        };
      }

      if (def.source === "ai_copy" || def.source === "ai_image") {
        return {
          field: fieldKey,
          label,
          source: def.source,
          status: "ai_generated" as FieldStatus,
          value: null,
          editable: false,
        };
      }

      // source === "feed"
      const raw = feedValues[fieldKey];
      const value = raw != null && raw !== "" ? raw : null;

      if (value !== null) {
        return {
          field: fieldKey,
          label,
          source: def.source,
          status: "ok" as FieldStatus,
          value,
          editable: true,
        };
      }

      if (!def.required) {
        return {
          field: fieldKey,
          label,
          source: def.source,
          status: "missing_optional" as FieldStatus,
          value: null,
          editable: true,
        };
      }

      return {
        field: fieldKey,
        label,
        source: def.source,
        status: "missing_required" as FieldStatus,
        value: null,
        editable: true,
      };
    }
  );

  const blockedReasons = fields
    .filter((f) => f.status === "missing_required")
    .map((f) => `Missing required field: ${f.label}`);

  const ready = blockedReasons.length === 0;

  return {
    mapping_key: `${context.sale_id}:${schema.id}`,
    sale_id: context.sale_id,
    template_id: schema.id,
    context,
    template: schema,
    fields,
    ready,
    blocked: !ready,
    blocked_reasons: blockedReasons,
  };
}

/**
 * Entry point for the Review Brief step.
 * Resolves all wine × template combinations in one call.
 */
export function resolveBatchMappings(
  contexts: WineAdContext[],
  templateIds: string[]
): BatchMappingResult {
  const mappings: TemplateMappingResult[] = [];

  for (const context of contexts) {
    for (const templateId of templateIds) {
      const schema = TEMPLATE_SCHEMAS[templateId];
      if (!schema) continue;
      mappings.push(resolveTemplateFields(context, schema));
    }
  }

  return {
    mappings,
    ready_count: mappings.filter((m) => m.ready).length,
    blocked_count: mappings.filter((m) => m.blocked).length,
    total: mappings.length,
  };
}

/**
 * Build the Claude copy prompt for one wine × template.
 * Score section is conditional — never references score if has_score is false.
 */
export function buildCopyPrompt(
  context: WineAdContext,
  template: TemplateSchema,
  options: { tone?: string; overrides?: Record<string, string> } = {}
): string {
  const { tone = "irreverent", overrides = {} } = options;

  const effectiveScore =
    overrides["score_badge"] != null && overrides["score_badge"] !== ""
      ? overrides["score_badge"]
      : context.has_score && context.score != null
      ? String(context.score)
      : null;
  const effectiveLabel =
    overrides["score_label"] != null && overrides["score_label"] !== ""
      ? overrides["score_label"]
      : context.has_score
      ? context.score_label
      : null;
  const effectiveHasScore = effectiveScore != null && effectiveScore !== "";

  const scoreSection = effectiveHasScore
    ? `- Critical Score: ${effectiveScore} points from ${effectiveLabel}`
    : "";

  const vineyard = context.vineyard ? `- Vineyard: ${context.vineyard}` : "";
  const abv = context.abv != null ? `- ABV: ${context.abv}%` : "";

  const overrideNote =
    Object.keys(overrides).length > 0
      ? `\nOVERRIDES (use these exact values):\n${Object.entries(overrides)
          .map(([k, v]) => `- ${k}: ${v}`)
          .join("\n")}`
      : "";

  return `You are writing Meta ad copy for Wine Spies, a flash wine sales site with an irreverent, confident voice.

WINE:
- Name: ${context.display_name}
- Varietal: ${context.varietal}
- Appellation: ${context.appellation}
${vineyard}
${scoreSection}
- Sale Price: ${context.sale_price} (was ${context.retail_price}, save ${context.savings} / ${context.discount_pct}% off)
${abv}

BRIEF:
${context.mini_brief_plain}

TEMPLATE: ${template.name}
TONE: ${tone}
${overrideNote}

Write ad copy in this exact JSON format:
{
  "headline": "short punchy headline under 40 chars",
  "primary_text": "2-4 sentence primary ad text with personality and a hook",
  "description": "1 sentence product description under 30 chars"
}

Rules:
- Never invent scores or ratings not explicitly provided
- Sale price must be accurate: ${context.sale_price}
${
  effectiveHasScore
    ? `- You MAY reference the ${effectiveScore}-point score from ${effectiveLabel}`
    : "- Do NOT mention any score or rating — none exists for this wine"
}
- Headline: under 40 characters
- Description: under 30 characters
- Voice: direct, confident, slightly irreverent — classic Wine Spies tone
- Lead with value or quality signal, create urgency without clichés

Return ONLY the JSON object. No markdown, no explanation.`;
}
