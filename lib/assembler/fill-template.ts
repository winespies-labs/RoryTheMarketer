/**
 * Minimal HTML template filler — no Handlebars dependency.
 *
 * Two passes:
 *   1. {{#if key}}...{{/if}} conditionals — removed if value is falsy
 *   2. {{key}} value replacements
 */

const CONDITIONAL = /\{\{#if\s+(\w+)\}\}([\s\S]*?)\{\{\/if\}\}/g;
const TOKEN = /\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g;

export function fillTemplate(
  html: string,
  slots: Record<string, string | boolean | number | null | undefined>,
): string {
  // Pass 1: conditionals
  let result = html.replace(CONDITIONAL, (_match, key: string, inner: string) => {
    const val = slots[key];
    if (val === false || val === null || val === undefined || val === "" || val === 0) {
      return "";
    }
    return inner;
  });

  // Pass 2: value replacements
  result = result.replace(TOKEN, (_match, key: string) => {
    const val = slots[key.trim()];
    if (val === undefined || val === null || val === false) return "";
    return String(val);
  });

  return result;
}
