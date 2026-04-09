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

// =============================================================================
// TEMPLATE FIELD SCHEMA
// Each reference template declares the fields it needs from WineAdContext.
// This powers the Review Brief field-mapping table.
// =============================================================================

export type FieldSource = "feed" | "ai_copy" | "ai_image" | "static";

export type FallbackBehavior =
  | "hide_element"
  | "omit_field"
  | "required"
  | { default: string };

export interface TemplateField {
  key: string;
  context_key?: keyof WineAdContext;
  source: FieldSource;
  required: boolean;
  fallback: FallbackBehavior;
  description: string;
}

export interface TemplateSchema {
  template_id: string;   // must match the id returned by /api/pdp/styles
  template_name: string;
  fields: TemplateField[];
}

// =============================================================================
// TEMPLATE DEFINITIONS
// Add one entry per reference template in context/Examples/Ads/Static/.
// template_id must match the `id` field in the corresponding .md frontmatter.
// =============================================================================

export const TEMPLATE_SCHEMAS: TemplateSchema[] = [
  {
    template_id: "winespies_pdp_cult_1",
    template_name: "Wine Spies PDP Cult 1",
    fields: [
      {
        key: "wine_display_name",
        context_key: "display_name",
        source: "feed",
        required: true,
        fallback: "required",
        description: "Vintage + producer + wine name",
      },
      {
        key: "retail_price",
        context_key: "retail_price",
        source: "feed",
        required: true,
        fallback: "required",
        description: "Original retail price",
      },
      {
        key: "sale_price",
        context_key: "sale_price",
        source: "feed",
        required: true,
        fallback: "required",
        description: "Today's sale price",
      },
      {
        key: "score_badge",
        context_key: "score_label",
        source: "feed",
        required: false,
        fallback: "hide_element",
        description: "Points badge — hidden if no score, never defaulted",
      },
      {
        key: "bottle_image",
        context_key: "composite_image_url",
        source: "feed",
        required: true,
        fallback: "required",
        description: "Composite bottle image overlaid on background",
      },
      {
        key: "background_image",
        source: "ai_image",
        required: true,
        fallback: "required",
        description: "AI-generated styled background (Gemini)",
      },
      {
        key: "headline",
        source: "ai_copy",
        required: true,
        fallback: "required",
        description: "Ad headline — generated at runtime",
      },
      {
        key: "primary_text",
        source: "ai_copy",
        required: true,
        fallback: "required",
        description: "Primary ad body copy — generated at runtime",
      },
      {
        key: "cta_button",
        source: "static",
        required: true,
        fallback: { default: "GET THIS DEAL" },
        description: "CTA button text",
      },
    ],
  },
];

// =============================================================================
// FIELD MAPPING & VALIDATION
// =============================================================================

export type FieldStatus =
  | "ok"
  | "missing_optional"
  | "missing_required"
  | "ai_generated"
  | "static";

export interface ResolvedField {
  key: string;
  description: string;
  source: FieldSource;
  status: FieldStatus;
  value: string | number | boolean | null;
  fallback_behavior: FallbackBehavior;
  will_render: boolean;
}

export interface TemplateMappingResult {
  template_id: string;
  template_name: string;
  wine_display_name: string;
  sale_id: number;
  can_generate: boolean;
  blocking_fields: string[];
  fields: ResolvedField[];
}

/**
 * Resolves a WineAdContext against a TemplateSchema.
 * Returns a TemplateMappingResult that powers the Review Brief UI.
 */
export function resolveTemplateFields(
  context: WineAdContext,
  schema: TemplateSchema
): TemplateMappingResult {
  const resolvedFields: ResolvedField[] = [];
  const blockingFields: string[] = [];

  for (const field of schema.fields) {
    let value: string | number | boolean | null = null;
    let status: FieldStatus;
    let will_render = true;

    if (field.source === "static") {
      value =
        typeof field.fallback === "object" && "default" in field.fallback
          ? field.fallback.default
          : null;
      status = "static";
    } else if (field.source === "ai_copy" || field.source === "ai_image") {
      status = "ai_generated";
      value = null;
    } else {
      // feed source
      if (field.context_key) {
        const raw = context[field.context_key];
        value = raw !== undefined ? (raw as string | number | boolean | null) : null;
      }

      const isEmpty =
        value === null || value === undefined || value === "" || value === 0;

      if (isEmpty) {
        if (field.fallback === "required") {
          status = "missing_required";
          will_render = false;
          blockingFields.push(field.key);
        } else if (
          field.fallback === "hide_element" ||
          field.fallback === "omit_field"
        ) {
          status = "missing_optional";
          will_render = false;
        } else if (
          typeof field.fallback === "object" &&
          "default" in field.fallback
        ) {
          value = field.fallback.default;
          status = "ok";
        } else {
          status = "missing_optional";
          will_render = false;
        }
      } else {
        status = "ok";
      }
    }

    resolvedFields.push({
      key: field.key,
      description: field.description,
      source: field.source,
      status,
      value: value ?? null,
      fallback_behavior: field.fallback,
      will_render,
    });
  }

  return {
    template_id: schema.template_id,
    template_name: schema.template_name,
    wine_display_name: context.display_name,
    sale_id: context.sale_id,
    can_generate: blockingFields.length === 0,
    blocking_fields: blockingFields,
    fields: resolvedFields,
  };
}

export interface BatchMappingResult {
  wines: WineAdContext[];
  schemas: TemplateSchema[];
  /** keyed as `${sale_id}:${template_id}` */
  mappings: Record<string, TemplateMappingResult>;
  total_ads: number;
  ready_to_generate: number;
  blocked: number;
}

/**
 * Resolves N wines × M templates into a BatchMappingResult.
 * Templates with a TEMPLATE_SCHEMAS entry get full field validation.
 * Templates without a schema entry get a stub result (always ready, no fields).
 */
export function resolveBatchMappings(
  contexts: WineAdContext[],
  styles: { id: string; name: string }[]
): BatchMappingResult {
  const knownIds = new Set(TEMPLATE_SCHEMAS.map((s) => s.template_id));
  const schemas = TEMPLATE_SCHEMAS.filter((s) =>
    styles.some((style) => style.id === s.template_id)
  );
  const stubStyles = styles.filter((style) => !knownIds.has(style.id));

  const mappings: Record<string, TemplateMappingResult> = {};
  let ready = 0;
  let blocked = 0;

  for (const context of contexts) {
    for (const schema of schemas) {
      const key = `${context.sale_id}:${schema.template_id}`;
      const result = resolveTemplateFields(context, schema);
      mappings[key] = result;
      if (result.can_generate) ready++;
      else blocked++;
    }
    for (const style of stubStyles) {
      const key = `${context.sale_id}:${style.id}`;
      mappings[key] = {
        template_id: style.id,
        template_name: style.name,
        wine_display_name: context.display_name,
        sale_id: context.sale_id,
        can_generate: true,
        blocking_fields: [],
        fields: [],
      };
      ready++;
    }
  }

  const stubSchemas: TemplateSchema[] = stubStyles.map((s) => ({
    template_id: s.id,
    template_name: s.name,
    fields: [],
  }));

  return {
    wines: contexts,
    schemas: [...schemas, ...stubSchemas],
    mappings,
    total_ads: contexts.length * styles.length,
    ready_to_generate: ready,
    blocked,
  };
}
