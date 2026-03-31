import type { WineDetails, CopyVariation } from "@/lib/ad-builder";
import { getBrand } from "@/lib/brands";

/**
 * Replace `{{name}}` placeholders in template strings with wine / run data.
 *
 * Supported keys come from `wineDetails` (e.g. {{headline}}, {{pullQuote}}, {{salePrice}}),
 * plus: {{wineName}}, {{destinationUrl}} / {{saleUrl}} (when brand + saleId resolve).
 *
 * After copy generation, use `copy.*`: {{copy.headline}}, {{copy.primaryText}}, {{copy.description}}.
 *
 * Unknown or empty keys leave the original `{{token}}` so missing data is visible while authoring.
 */
export type PromptVariableContext = {
  wineDetails?: Partial<WineDetails>;
  wineName?: string;
  saleId?: number;
  brandId?: string;
  copy?: Partial<CopyVariation>;
};

const TOKEN = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

export function buildVariableMap(context: PromptVariableContext): Record<string, string> {
  const out: Record<string, string> = {};
  const wd = context.wineDetails ?? {};
  for (const [k, v] of Object.entries(wd)) {
    if (v === undefined || v === null) continue;
    const s = String(v).trim();
    if (s.length > 0) out[k] = s;
  }
  if (context.wineName?.trim()) {
    out.wineName = context.wineName.trim();
  }
  const brand = context.brandId ? getBrand(context.brandId) : undefined;
  if (brand?.domain && context.saleId != null && context.saleId > 0) {
    const url = `https://${brand.domain}/sales/${context.saleId}`;
    out.destinationUrl = url;
    out.saleUrl = url;
  }
  return out;
}

export function substitutePromptVariables(
  text: string | undefined,
  context: PromptVariableContext,
): string {
  if (!text) return "";
  const map = buildVariableMap(context);
  return text.replace(TOKEN, (full, rawKey: string) => {
    const key = rawKey.trim();
    if (key.startsWith("copy.")) {
      const sub = key.slice(5) as keyof CopyVariation;
      const v = context.copy?.[sub];
      return typeof v === "string" && v.trim().length > 0 ? v.trim() : full;
    }
    if (Object.prototype.hasOwnProperty.call(map, key)) {
      return map[key]!;
    }
    return full;
  });
}
