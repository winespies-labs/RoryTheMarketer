/**
 * Utilities for building normalized tag slugs from markdown section paths.
 *
 * The core requirement is:
 * - store normalized slugs in `ContextLibraryItem.tags` (so filtering is consistent)
 * - derive human-readable labels from slugs for card badges/chips
 */

export function slugifyTagSegment(input: string): string {
  return input
    .toLowerCase()
    // common markdown symbols
    .replace(/&/g, " and ")
    .replace(/[“”"']/g, "")
    // treat slashes as separators (e.g. "Nostalgia / Time" -> "nostalgia time")
    .replace(/\//g, " ")
    // anything else that's not alphanumeric/space/hyphen/underscore becomes a space
    .replace(/[^a-z0-9 _-]+/g, " ")
    // collapse whitespace
    .trim()
    .replace(/\s+/g, "_")
    .replace(/_+/g, "_");
}

export function makePrimaryAndLeafTags(args: {
  sectionHeading: string;
  subHeading?: string;
}): { primaryTag: string; leafTag: string; tags: string[] } {
  const primarySlug = slugifyTagSegment(args.sectionHeading);
  const subSlug = args.subHeading ? slugifyTagSegment(args.subHeading) : "";

  if (!subSlug) {
    return { primaryTag: primarySlug, leafTag: primarySlug, tags: [primarySlug] };
  }

  const primaryTag = `${primarySlug}/${subSlug}`;
  const leafTag = subSlug;

  // Convention:
  // - tags[0] is the "primary tag" (card badge / primary filter)
  // - tags[1] is the "leaf tag" for broader searching
  return { primaryTag, leafTag, tags: [primaryTag, leafTag] };
}

export function getLeafTag(tagSlug: string): string {
  return tagSlug.split("/").filter(Boolean).pop() ?? tagSlug;
}

export function tagSlugToLabel(tagSlug: string): string {
  // turn e.g. "nostalgia_time" -> "Nostalgia Time"
  // and "openers_intros/nostalgia_time" -> "Openers Intros / Nostalgia Time"
  return tagSlug
    .split("/")
    .filter(Boolean)
    .map((part) =>
      part
        .split("_")
        .filter(Boolean)
        .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
        .join(" ")
    )
    .join(" / ");
}

