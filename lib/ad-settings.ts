// lib/ad-settings.ts
import fs from "fs";
import path from "path";

// Enhancement definitions — used by Settings UI and publish route
export const IMAGE_ENHANCEMENTS = [
  { slug: "show_relevant_comments", label: "Show relevant comments" },
  { slug: "visual_touchups", label: "Visual touchups" },
  { slug: "text_improvements", label: "Text improvements" },
  { slug: "add_text_overlays", label: "Add text overlays" },
  { slug: "brightness_contrast", label: "Brightness & contrast" },
  { slug: "music", label: "Music" },
  { slug: "animation", label: "Animation" },
  { slug: "add_site_links", label: "Add site links" },
  { slug: "add_catalog_items", label: "Add catalog items" },
  { slug: "add_details", label: "Add details" },
  { slug: "enhance_cta", label: "Enhance CTA" },
  { slug: "reveal_details", label: "Reveal details" },
  { slug: "flex_media", label: "Flex media" },
  { slug: "translate_text", label: "Translate text" },
  { slug: "show_summaries", label: "Show summaries" },
  { slug: "show_spotlights", label: "Show spotlights" },
] as const;

export const VIDEO_ENHANCEMENTS = [
  { slug: "show_relevant_comments", label: "Show relevant comments" },
  { slug: "visual_touchups", label: "Visual touchups" },
  { slug: "text_improvements", label: "Text improvements" },
  { slug: "add_video_effects", label: "Add video effects" },
  { slug: "add_catalog_items", label: "Add catalog items" },
  { slug: "add_site_links", label: "Add site links" },
  { slug: "add_details", label: "Add details" },
  { slug: "enhance_cta", label: "Enhance CTA" },
  { slug: "reveal_details", label: "Reveal details" },
  { slug: "flex_media", label: "Flex media" },
  { slug: "translate_text", label: "Translate text" },
  { slug: "show_summaries", label: "Show summaries" },
  { slug: "show_spotlights", label: "Show spotlights" },
] as const;

export const CAROUSEL_ENHANCEMENTS = [
  { slug: "show_relevant_comments", label: "Show relevant comments" },
  { slug: "visual_touchups", label: "Visual touchups" },
  { slug: "profile_end_card", label: "Profile end card" },
  { slug: "highlight_card", label: "Highlight card" },
  { slug: "dynamic_description", label: "Dynamic description" },
  { slug: "adapt_multi_image", label: "Adapt multi-image" },
  { slug: "enhance_cta", label: "Enhance CTA" },
] as const;

export interface AdSettings {
  utm: {
    source: string;
    medium: string;
    campaign: string;
    content: string;
    rawOverride: string;
  };
  creativeEnhancements: {
    images: Record<string, boolean>;
    videos: Record<string, boolean>;
    carousel: Record<string, boolean>;
  };
}

const DEFAULT_SETTINGS: AdSettings = {
  utm: { source: "", medium: "", campaign: "", content: "", rawOverride: "" },
  creativeEnhancements: { images: {}, videos: {}, carousel: {} },
};

function settingsPath(brandId: string): string {
  return path.join(process.cwd(), "data", brandId, "ad-settings.json");
}

export function getAdSettings(brandId: string): AdSettings {
  try {
    const raw = fs.readFileSync(settingsPath(brandId), "utf-8");
    const parsed = JSON.parse(raw) as Partial<AdSettings>;
    return {
      utm: { ...DEFAULT_SETTINGS.utm, ...(parsed.utm ?? {}) },
      creativeEnhancements: {
        images: parsed.creativeEnhancements?.images ?? {},
        videos: parsed.creativeEnhancements?.videos ?? {},
        carousel: parsed.creativeEnhancements?.carousel ?? {},
      },
    };
  } catch {
    return {
      utm: { ...DEFAULT_SETTINGS.utm },
      creativeEnhancements: { images: {}, videos: {}, carousel: {} },
    };
  }
}

export function saveAdSettings(brandId: string, settings: AdSettings): void {
  const p = settingsPath(brandId);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(settings, null, 2), "utf-8");
}

/**
 * Appends UTM params to a URL. If rawOverride is set it is appended as-is
 * and the individual fields are ignored.
 */
export function applyUtm(url: string, utm: AdSettings["utm"]): string {
  if (utm.rawOverride.trim()) {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}${utm.rawOverride.trim()}`;
  }
  const params: string[] = [];
  if (utm.source) params.push(`utm_source=${encodeURIComponent(utm.source)}`);
  if (utm.medium) params.push(`utm_medium=${encodeURIComponent(utm.medium)}`);
  if (utm.campaign) params.push(`utm_campaign=${encodeURIComponent(utm.campaign)}`);
  if (utm.content) params.push(`utm_content=${encodeURIComponent(utm.content)}`);
  if (!params.length) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}${params.join("&")}`;
}

/**
 * Builds a Meta degrees_of_freedom_spec from enabled enhancement slugs.
 * Returns undefined when no enhancements are enabled (omit field from API call).
 */
export function buildDegreesOfFreedomSpec(
  enhancements: Record<string, boolean>,
): Record<string, unknown> | undefined {
  const enabledSlugs = Object.entries(enhancements)
    .filter(([, v]) => v)
    .map(([k]) => k);
  if (!enabledSlugs.length) return undefined;
  const features: Record<string, { enroll_status: "OPT_IN" }> = {};
  for (const slug of enabledSlugs) {
    features[slug] = { enroll_status: "OPT_IN" };
  }
  return { creative_features_spec: features };
}
