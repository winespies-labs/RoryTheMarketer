import type { UspCategory } from "@/lib/reviews";

export interface ParsedBestReview {
  author: string;
  content: string;
  extractedQuote: string;
  uspCategory: UspCategory;
  /** ISO date string, e.g. "2025-04-01T00:00:00.000Z" */
  createdAt: string;
}

const CATEGORY_MAP: Record<string, UspCategory> = {
  "customer service": "customer-service",
  "deals / pricing": "deals-pricing",
  "deals/pricing": "deals-pricing",
  "curation / quality": "curation-quality",
  "curation/quality": "curation-quality",
  "locker": "locker",
  "trust / reliability": "trust-reliability",
  "trust/reliability": "trust-reliability",
  "experience / fun": "experience-fun",
  "experience/fun": "experience-fun",
};

function slugifyCategory(raw: string): UspCategory | null {
  const key = raw.trim().toLowerCase();
  return CATEGORY_MAP[key] ?? null;
}

function parseDate(raw: string): string {
  // raw is like "Apr 2025" or "Jan 2026"
  const d = new Date(raw.trim());
  if (!isNaN(d.getTime())) return d.toISOString();
  return new Date().toISOString();
}

function extractBold(text: string): string | null {
  const match = text.match(/\*\*(.+?)\*\*/);
  if (!match) return null;
  return match[1].trim();
}

function stripBlockquote(lines: string[]): string {
  return lines
    .filter((l) => l.trimStart().startsWith(">"))
    .map((l) => l.trimStart().replace(/^>\s?/, ""))
    .join(" ")
    .trim();
}

export function parseBestReviewsMd(markdown: string): ParsedBestReview[] {
  const results: ParsedBestReview[] = [];

  // Split into H2 sections (## Category Name)
  const sectionBlocks = markdown.split(/\n(?=## )/);

  for (const block of sectionBlocks) {
    const lines = block.split("\n");
    const h2Line = lines[0].trim();
    if (!h2Line.startsWith("## ")) continue;

    const categoryRaw = h2Line.replace(/^## /, "").trim();
    const uspCategory = slugifyCategory(categoryRaw);
    if (!uspCategory) continue; // skip preamble / unknown sections

    // Split into H3 review blocks (### ⭐ ...)
    const reviewBlocks = block.split(/\n(?=### )/);

    for (let i = 1; i < reviewBlocks.length; i++) {
      const rb = reviewBlocks[i];
      const rbLines = rb.split("\n");
      const h3Line = rbLines[0].trim();

      if (!h3Line.startsWith("### ")) continue;

      // Parse heading: "### ⭐ Name — "Title" *(Date)*"
      const heading = h3Line.replace(/^### ⭐?\s*/, "").trim();
      const dashIdx = heading.indexOf(" — ");
      const author = dashIdx >= 0 ? heading.slice(0, dashIdx).trim() : "";

      // Extract date from *(Month Year)*
      const dateMatch = heading.match(/\*\(([^)]+)\)\*/);
      const createdAt = dateMatch ? parseDate(dateMatch[1]) : new Date().toISOString();

      // Extract blockquote content
      const content = stripBlockquote(rbLines);
      if (!content) continue;

      // extractedQuote: bold text if present, else first 250 chars
      const bold = extractBold(content);
      const extractedQuote = bold ?? content.slice(0, 250).trim();

      results.push({
        author,
        content,
        extractedQuote,
        uspCategory,
        createdAt,
      });
    }
  }

  return results;
}
