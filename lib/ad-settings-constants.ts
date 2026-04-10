// lib/ad-settings-constants.ts
// Client-safe constants and types — no Node.js imports.
// Server-side functions (getAdSettings, saveAdSettings, applyUtm, etc.) live in lib/ad-settings.ts.

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
