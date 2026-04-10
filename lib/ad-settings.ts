// lib/ad-settings.ts
import fs from "fs";
import path from "path";
import { type AdSettings } from "@/lib/ad-settings-constants";

// Re-export client-safe constants and types from the constants file.
// Server-side functions below require Node.js and must not be imported in client components.
export {
  IMAGE_ENHANCEMENTS,
  VIDEO_ENHANCEMENTS,
  CAROUSEL_ENHANCEMENTS,
  type AdSettings,
} from "@/lib/ad-settings-constants";

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
