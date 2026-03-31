/**
 * Swipe Inspiration Center — personal creative library (copy + screenshots).
 * Separate from context library; items can optionally be "added to context" for use in briefs.
 */

export type SwipeInspirationType = "copy" | "image";

/** Copywriting / creative styles for search and filter */
export const STYLES = [
  { value: "direct_response", label: "Direct response" },
  { value: "storytelling", label: "Storytelling" },
  { value: "urgency", label: "Urgency / scarcity" },
  { value: "social_proof", label: "Social proof" },
  { value: "benefit_driven", label: "Benefit-driven" },
  { value: "curiosity", label: "Curiosity / hook" },
  { value: "pain_point", label: "Pain point" },
  { value: "humor", label: "Humor" },
  { value: "minimal", label: "Minimal / punchy" },
  { value: "long_form", label: "Long-form" },
  { value: "other", label: "Other" },
] as const;

export type SwipeStyle = (typeof STYLES)[number]["value"];

/** Categories for organizing inspiration */
export const CATEGORIES = [
  { value: "copywriting", label: "Copywriting" },
  { value: "conversion_optimization", label: "Conversion optimization" },
  { value: "ad_screenshot", label: "Ad screenshot" },
  { value: "landing_page", label: "Landing page" },
  { value: "email", label: "Email" },
  { value: "social", label: "Social" },
  { value: "reference_ad", label: "Reference ad" },
  { value: "other", label: "Other" },
] as const;

export type SwipeCategory = (typeof CATEGORIES)[number]["value"];

export interface SwipeInspirationItem {
  id: string;
  type: SwipeInspirationType;
  /** For copy: the text; for image: optional caption/notes */
  content: string;
  title?: string;
  /** Copywriting style (searchable) */
  style?: SwipeStyle;
  category?: SwipeCategory;
  tags?: string[];
  /** When type === "image", filename under brand's swipe-inspiration-assets dir (filesystem mode) */
  imageFile?: string;
  /** When type === "image", true if bytes are stored in Postgres (no local filename) */
  hasStoredImage?: boolean;
  /** If true, can be "added to context" for use in briefs/copywriter */
  useInContext?: boolean;
  addedAt: string;
}

export interface SwipeInspirationData {
  updatedAt: string;
  items: SwipeInspirationItem[];
}

export const SWIPE_INSPIRATION_FILENAME = "swipe-inspiration.json";
export const SWIPE_INSPIRATION_ASSETS_DIR = "swipe-inspiration-assets";
