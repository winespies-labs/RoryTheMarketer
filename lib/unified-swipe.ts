import type { ContextLibraryItem } from "@/lib/context-library";
import type { Technique, DrillSwipe } from "@/lib/copy-drill-data";

export type SwipeSource = "library" | "drill" | "extracted";

export interface UnifiedSwipe {
  id: string;
  title: string;
  content: string;
  source: SwipeSource;
  tags: string[];
  category: string;
  whyItWorks: string | null;
  drillPrompt: string | null;
  drillExample: string | null;
  mechanism: string | null;
  starred: boolean;
  addedAt: string | null;
  libraryMeta?: Record<string, unknown>;
  libraryType?: string;
  techniqueId?: string;
}

/** Convert context library items (type=swipe/copywriting/ad_copy) to UnifiedSwipe[] */
export function normalizeLibraryItems(items: ContextLibraryItem[]): UnifiedSwipe[] {
  return items.map((item) => ({
    id: `lib-${item.id}`,
    title: item.title || "(untitled)",
    content: item.content,
    source: "library" as const,
    tags: dedup((item.tags ?? []).map(normalizeTag)),
    category: normalizeCategory(inferCategoryFromTags(item.tags ?? [])),
    whyItWorks:
      typeof item.meta?.whyItWorks === "string" ? item.meta.whyItWorks : null,
    drillPrompt: null,
    drillExample: null,
    mechanism:
      typeof item.meta?.mechanism === "string" ? item.meta.mechanism : null,
    starred: item.meta?.starred === true,
    addedAt: item.addedAt,
    libraryMeta: item.meta,
    libraryType: item.type,
    // Keep the raw context-library id for API calls
    _libraryId: item.id,
  })) as (UnifiedSwipe & { _libraryId: string })[];
}

/** Convert static drill techniques to UnifiedSwipe[] */
export function normalizeDrills(techniques: Technique[]): UnifiedSwipe[] {
  const swipes: UnifiedSwipe[] = [];
  for (const tech of techniques) {
    for (const drill of tech.swipes) {
      swipes.push({
        id: `drill-${tech.id}-${drill.id}`,
        title: drill.title,
        content: drill.swipe,
        source: "drill",
        tags: [normalizeTag(tech.id)],
        category: normalizeCategory(tech.label),
        whyItWorks: drill.why,
        drillPrompt: drill.prompt,
        drillExample: drill.example,
        mechanism: drill.mechanism,
        starred: false,
        addedAt: null,
        techniqueId: tech.id,
      });
    }
  }
  return swipes;
}

/** Extracted swipes from the swipe-analysis/swipes API */
export interface ExtractedSwipe {
  id: string;
  title: string;
  category: string;
  swipe: string;
  why: string;
  remixPrompt: string;
}

/** Convert extracted swipes to UnifiedSwipe[] */
export function normalizeExtractedSwipes(
  swipes: ExtractedSwipe[]
): UnifiedSwipe[] {
  return swipes.map((s) => ({
    id: `ext-${s.id}`,
    title: s.title,
    content: s.swipe,
    source: "extracted" as const,
    tags: [normalizeTag(slugify(s.category))],
    category: normalizeCategory(s.category),
    whyItWorks: s.why || null,
    drillPrompt: s.remixPrompt || null,
    drillExample: null,
    mechanism: null,
    starred: false,
    addedAt: null,
  }));
}

/** Get the raw context-library ID from a unified swipe (library items only) */
export function getLibraryId(swipe: UnifiedSwipe): string | null {
  if (swipe.source !== "library") return null;
  return (swipe as UnifiedSwipe & { _libraryId?: string })._libraryId ?? swipe.id.replace(/^lib-/, "");
}

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/** Normalize a category string to consistent Title Case, merging duplicates like
 *  "PRODUCER STORYTELLING" / "Producer Storytelling" / "Flavor & Sensory Copy" */
function normalizeCategory(raw: string): string {
  return raw
    .replace(/\s*\(continued\)\s*/gi, "")
    .replace(/&/g, " and ")
    .replace(/[^a-zA-Z0-9\s]/g, " ")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ") || "Uncategorized";
}

/** Normalize a tag slug to consistent hyphenated lowercase */
function normalizeTag(raw: string): string {
  return raw
    .split("/")
    .map((seg) =>
      seg
        .toLowerCase()
        .replace(/&/g, "and")
        .replace(/[^a-z0-9]/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "")
    )
    .filter(Boolean)
    .join("/");
}

function dedup(arr: string[]): string[] {
  return [...new Set(arr)];
}

function inferCategoryFromTags(tags: string[]): string {
  if (tags.length === 0) return "Uncategorized";
  // Use the first tag's leaf segment as category
  const first = tags[0];
  const leaf = first.split("/").pop() ?? first;
  return leaf
    .split(/[_-]/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}
