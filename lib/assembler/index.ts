import type { TemplateProduct } from "../template-product";
import type { TemplateSchema, SlotDefinition } from "../template-schema";

// ── Public types ──

export interface FilledSlot {
  key: string;
  value: string;
  source: string;
  truncated: boolean;
  editable: boolean;
}

export interface FilledBrief {
  templateId: string;
  productId: string;
  slots: FilledSlot[];
  pricePill: {
    retail: string;
    sale: string;
    savings: string;
    savingsPercent: number;
  } | null;
  promoCode: string | null;
  scoreBadge: { score: number; source: string } | null;
  ctaText: string;
  showTrustpilot: boolean;
  showLogo: boolean;
  backgroundImageUrl: string | null;
}

// ── Token regex (same pattern as lib/prompt-variables.ts) ──

const TOKEN = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

function resolveTokens(
  format: string,
  vars: Record<string, string | number>,
): string {
  return format.replace(TOKEN, (_full, key: string) => {
    const val = vars[key.trim()];
    return val !== undefined && val !== null ? String(val) : "";
  });
}

function truncate(value: string, maxChars?: number): { text: string; truncated: boolean } {
  if (!maxChars || value.length <= maxChars) return { text: value, truncated: false };
  // Truncate at word boundary when possible
  const cut = value.slice(0, maxChars);
  const lastSpace = cut.lastIndexOf(" ");
  const text = lastSpace > maxChars * 0.6 ? cut.slice(0, lastSpace) + "..." : cut + "...";
  return { text, truncated: true };
}

// ── Main assembler ──

export function assembleBrief(
  product: TemplateProduct,
  schema: TemplateSchema,
): FilledBrief {
  const savings = Math.round(product.price_retail - product.price_sale);
  const savingsPercent =
    product.price_retail > 0
      ? Math.round((savings / product.price_retail) * 100)
      : 0;

  // Variable map for token resolution
  const vars: Record<string, string | number> = {
    ...product,
    savings,
    savingsPercent,
    price_retail: product.price_retail,
    price_sale: product.price_sale,
  };

  const slots: FilledSlot[] = [];

  // Process headline slot
  if (schema.slots.headline && typeof schema.slots.headline === "object") {
    const def = schema.slots.headline as SlotDefinition;
    const raw = resolveSlotValue(def, product, vars);
    const { text, truncated } = truncate(raw, def.max_chars);
    slots.push({
      key: "headline",
      value: text,
      source: def.source,
      truncated,
      editable: true,
    });
  }

  // Process body slot
  if (schema.slots.body && typeof schema.slots.body === "object") {
    const def = schema.slots.body as SlotDefinition;
    const raw = resolveSlotValue(def, product, vars);
    const { text, truncated } = truncate(raw, def.max_chars);
    slots.push({
      key: "body",
      value: text,
      source: def.source,
      truncated,
      editable: true,
    });
  }

  // Price pill
  const pricePill = schema.slots.price_pill
    ? {
        retail: `$${product.price_retail}`,
        sale: `$${product.price_sale}`,
        savings: `$${savings}`,
        savingsPercent,
      }
    : null;

  // Promo code
  const promoCode = schema.slots.promo_code ? product.promo_code : null;

  // Score badge
  const scoreBadge =
    schema.slots.score_badge && product.score > 0
      ? { score: product.score, source: product.score_source }
      : null;

  // CTA
  const ctaText =
    typeof schema.slots.cta_text === "string"
      ? schema.slots.cta_text
      : product.cta || "SHOP NOW";

  return {
    templateId: schema.id,
    productId: product.id,
    slots,
    pricePill,
    promoCode,
    scoreBadge,
    ctaText,
    showTrustpilot: schema.slots.trustpilot === true,
    showLogo: schema.slots.logo === true,
    backgroundImageUrl: product.bottle_image_url || null,
  };
}

// ── Helpers ──

function resolveSlotValue(
  def: SlotDefinition,
  product: TemplateProduct,
  vars: Record<string, string | number>,
): string {
  if (def.source === "computed" && def.format) {
    return resolveTokens(def.format, vars);
  }
  // Source is a product field name
  const fieldValue = (product as unknown as Record<string, unknown>)[def.source];
  return fieldValue !== undefined && fieldValue !== null
    ? String(fieldValue)
    : "";
}
