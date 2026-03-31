/**
 * TemplateSchema — defines the slot structure and layout config for an HTML ad template.
 *
 * Each template directory (templates/{id}/) contains a schema.json and template.html.
 */

export interface SlotDefinition {
  /** Where the value comes from: "computed" (format string), a product field name, or "static" */
  source: "computed" | string;
  /** Format string with {{field}} tokens (only when source === "computed") */
  format?: string;
  /** Product field name to try if primary source resolves empty */
  fallback?: string;
  /** Max characters before truncation */
  max_chars?: number;
}

export interface LayoutConfig {
  text_zone_width: string;
  text_zone_position: "left" | "right" | "center";
  background_image_slot: boolean;
  aspect_ratio: string;
  width: number;
  height: number;
}

export interface TemplateSchema {
  id: string;
  name: string;
  slots: {
    headline?: SlotDefinition;
    body?: SlotDefinition;
    price_pill?: boolean;
    promo_code?: boolean;
    score_badge?: boolean;
    trustpilot?: boolean;
    cta_text?: string;
    logo?: boolean;
    [key: string]: SlotDefinition | boolean | string | undefined;
  };
  layout: LayoutConfig;
}
