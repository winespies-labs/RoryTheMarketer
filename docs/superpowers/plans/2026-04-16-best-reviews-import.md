# Best Reviews Import Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Import `wine_spies_best_reviews.md` (831 curated reviews) into the reviews DB with USP categories + extracted quotes, surfaced in the Ad Scores tab and injected into every AI prompt via the existing context bundle pipeline.

**Architecture:** Expand `UspCategory` from 3 → 6 values. Write a pure MD parser (`lib/parse-best-reviews-md.ts`). Add a DB import function to `lib/reviews-db.ts` that creates review rows with scoring fields pre-populated and dedupes by content hash. Expose a POST endpoint at `/api/reviews/import-best-reviews`. Add an "Import MD" button to `AdScoresPanel`.

**Tech Stack:** Next.js App Router, Prisma 6, TypeScript strict, React 19, Tailwind CSS 4

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `lib/reviews.ts` | Modify | Expand `UspCategory` union to 6 values |
| `lib/context-bundle.ts` | Modify | Add `USP_LABELS` entries for 6 categories |
| `lib/reviews-db.ts` | Modify | Add `importBestReviewsDb()`, update `loadTopTestimonialsDb()` category list |
| `lib/reviews-storage.ts` | Modify | Update `loadTopTestimonialsForContext()` category list |
| `lib/parse-best-reviews-md.ts` | Create | Pure MD parser, no I/O |
| `app/api/reviews/import-best-reviews/route.ts` | Create | POST endpoint, calls parser + DB |
| `app/reviews/AdScoresPanel.tsx` | Modify | Update tabs/badges for 6 categories, add import button |

---

## Task 1: Expand UspCategory to 6 values

**Files:**
- Modify: `lib/reviews.ts:4`
- Modify: `lib/context-bundle.ts:29–33`

- [ ] **Step 1: Update `UspCategory` in `lib/reviews.ts`**

Replace line 4:
```typescript
// Before
export type UspCategory = "best-price" | "locker" | "satisfaction-guaranteed";

// After
export type UspCategory =
  | "best-price"
  | "locker"
  | "satisfaction-guaranteed"
  | "customer-service"
  | "deals-pricing"
  | "curation-quality"
  | "trust-reliability"
  | "experience-fun";
```

- [ ] **Step 2: Update `USP_LABELS` in `lib/context-bundle.ts`**

Replace the `USP_LABELS` constant (lines 29–33):
```typescript
const USP_LABELS: Record<UspCategory, string> = {
  "best-price": "Best Price",
  "locker": "The Locker",
  "satisfaction-guaranteed": "Satisfaction Guaranteed",
  "customer-service": "Customer Service",
  "deals-pricing": "Deals & Pricing",
  "curation-quality": "Curation & Quality",
  "trust-reliability": "Trust & Reliability",
  "experience-fun": "Experience & Fun",
};
```

- [ ] **Step 3: Commit**
```bash
git add lib/reviews.ts lib/context-bundle.ts
git commit -m "feat: expand UspCategory from 3 to 8 values"
```

---

## Task 2: Update loadTopTestimonials category lists

**Files:**
- Modify: `lib/reviews-db.ts:331`
- Modify: `lib/reviews-storage.ts:339`

- [ ] **Step 1: Update `loadTopTestimonialsDb` in `lib/reviews-db.ts`**

Replace line 331:
```typescript
// Before
const categories: UspCategory[] = ["best-price", "locker", "satisfaction-guaranteed"];

// After
const categories: UspCategory[] = [
  "best-price",
  "locker",
  "satisfaction-guaranteed",
  "customer-service",
  "deals-pricing",
  "curation-quality",
  "trust-reliability",
  "experience-fun",
];
```

- [ ] **Step 2: Update `loadTopTestimonialsForContext` in `lib/reviews-storage.ts`**

Replace line 339:
```typescript
// Before
const categories: UspCategory[] = ["best-price", "locker", "satisfaction-guaranteed"];

// After
const categories: UspCategory[] = [
  "best-price",
  "locker",
  "satisfaction-guaranteed",
  "customer-service",
  "deals-pricing",
  "curation-quality",
  "trust-reliability",
  "experience-fun",
];
```

- [ ] **Step 3: Commit**
```bash
git add lib/reviews-db.ts lib/reviews-storage.ts
git commit -m "feat: update loadTopTestimonials to query all 8 USP categories"
```

---

## Task 3: Write the MD parser

**Files:**
- Create: `lib/parse-best-reviews-md.ts`

The MD format being parsed:
```
## Customer Service          ← H2 = USP category section
### ⭐ Name — "Title" *(Apr 2025)*   ← H3 = one review
*Also touches: ...*          ← optional, ignored
                             ← blank line
> Full review text here.     ← blockquote lines = content
> More text **bold quote.**  ← bold within blockquote = extractedQuote
```

Category → slug mapping used by the parser:
```
"Customer Service"    → "customer-service"
"Deals / Pricing"     → "deals-pricing"
"Curation / Quality"  → "curation-quality"
"Locker"              → "locker"
"Trust / Reliability" → "trust-reliability"
"Experience / Fun"    → "experience-fun"
```

- [ ] **Step 1: Create `lib/parse-best-reviews-md.ts`**

```typescript
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
```

- [ ] **Step 2: Commit**
```bash
git add lib/parse-best-reviews-md.ts
git commit -m "feat: add MD parser for best-reviews import"
```

---

## Task 4: Add importBestReviewsDb to reviews-db.ts

**Files:**
- Modify: `lib/reviews-db.ts` (append new export)

This function dedupes by content (not slackMessageTs) and inserts with all scoring fields pre-populated in a single `create` call.

- [ ] **Step 1: Append `importBestReviewsDb` to `lib/reviews-db.ts`**

Add at the end of the file:
```typescript
export interface BestReviewImportRow {
  content: string;
  author?: string;
  createdAt: string;
  uspCategory: UspCategory;
  adScore: number;
  extractedQuote: string;
  scoredAt: string;
}

/** Import hand-curated reviews with scoring pre-populated.
 *  Dedupes by exact content match — safe to call multiple times. */
export async function importBestReviewsDb(
  brandId: string,
  reviews: BestReviewImportRow[]
): Promise<{ inserted: number; skipped: number }> {
  const prisma = getPrisma();

  // Load existing content for dedup
  const existing = await prisma.customerReview.findMany({
    where: { brandId },
    select: { content: true },
  });
  const existingContent = new Set(existing.map((r) => r.content));

  const existingIds = await prisma.customerReview.findMany({
    where: { brandId },
    select: { id: true },
  });
  const idSet = new Set(existingIds.map((x) => x.id));

  let inserted = 0;
  let skipped = 0;

  for (const r of reviews) {
    if (existingContent.has(r.content)) {
      skipped++;
      continue;
    }
    let id = nanoid();
    while (idSet.has(id)) id = nanoid();
    idSet.add(id);
    existingContent.add(r.content);

    try {
      await prisma.customerReview.create({
        data: {
          id,
          brandId,
          source: "trustpilot",
          title: null,
          content: r.content,
          author: r.author ?? null,
          rating: 5,
          createdAt: new Date(r.createdAt),
          slackMessageTs: null,
          starred: false,
          topics: [],
          uspCategory: r.uspCategory,
          adScore: r.adScore,
          extractedQuote: r.extractedQuote,
          scoredAt: new Date(r.scoredAt),
        },
      });
      inserted++;
    } catch {
      skipped++;
    }
  }

  await touchMeta(brandId);
  return { inserted, skipped };
}
```

- [ ] **Step 2: Commit**
```bash
git add lib/reviews-db.ts
git commit -m "feat: add importBestReviewsDb with content-based dedup and scoring fields"
```

---

## Task 5: Add importBestReviews to reviews-storage.ts

**Files:**
- Modify: `lib/reviews-storage.ts` (append new export)

No file-mode fallback needed — this feature only makes sense with a DB. If no DB, return `{ inserted: 0, skipped: reviews.length }`.

- [ ] **Step 1: Add imports at top of `lib/reviews-storage.ts`**

The file already imports from `@/lib/reviews-db`. Add `importBestReviewsDb` and `BestReviewImportRow` to that import:
```typescript
// Before (line 8–14)
import {
  importJsonToDbIfEmpty,
  listReviewsFromDb,
  loadReviewsFromDb,
  mergeReviewsDb,
  updateReviewMetadataDb,
  updateReviewScoringDb,
  loadUnscoredReviewsDb,
  getUnscoredCountDb,
  loadTopTestimonialsDb,
  type ListReviewsFilters,
} from "@/lib/reviews-db";

// After
import {
  importJsonToDbIfEmpty,
  listReviewsFromDb,
  loadReviewsFromDb,
  mergeReviewsDb,
  updateReviewMetadataDb,
  updateReviewScoringDb,
  loadUnscoredReviewsDb,
  getUnscoredCountDb,
  loadTopTestimonialsDb,
  importBestReviewsDb,
  type BestReviewImportRow,
  type ListReviewsFilters,
} from "@/lib/reviews-db";
```

- [ ] **Step 2: Re-export `BestReviewImportRow` and append `importBestReviews` at end of `lib/reviews-storage.ts`**

```typescript
export type { BestReviewImportRow };

export async function importBestReviews(
  brandId: string,
  reviews: BestReviewImportRow[]
): Promise<{ inserted: number; skipped: number }> {
  if (!useDatabase()) return { inserted: 0, skipped: reviews.length };
  await importJsonToDbIfEmpty(brandId);
  return importBestReviewsDb(brandId, reviews);
}
```

- [ ] **Step 3: Commit**
```bash
git add lib/reviews-storage.ts
git commit -m "feat: expose importBestReviews through reviews-storage"
```

---

## Task 6: Create the import API endpoint

**Files:**
- Create: `app/api/reviews/import-best-reviews/route.ts`

- [ ] **Step 1: Create `app/api/reviews/import-best-reviews/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getBrand } from "@/lib/brands";
import { parseBestReviewsMd } from "@/lib/parse-best-reviews-md";
import { importBestReviews } from "@/lib/reviews-storage";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as { brand?: string; markdown?: string };
    const brandId = body.brand ?? "winespies";

    if (!getBrand(brandId)) {
      return NextResponse.json({ error: "Unknown brand" }, { status: 400 });
    }
    if (!body.markdown || typeof body.markdown !== "string") {
      return NextResponse.json({ error: "Missing markdown" }, { status: 400 });
    }

    const parsed = parseBestReviewsMd(body.markdown);
    if (parsed.length === 0) {
      return NextResponse.json({ error: "No reviews parsed from markdown" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const rows = parsed.map((r) => ({
      content: r.content,
      author: r.author || undefined,
      createdAt: r.createdAt,
      uspCategory: r.uspCategory,
      adScore: 80,
      extractedQuote: r.extractedQuote,
      scoredAt: now,
    }));

    const result = await importBestReviews(brandId, rows);
    return NextResponse.json({ ok: true, parsed: parsed.length, ...result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Import failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
```

- [ ] **Step 2: Commit**
```bash
git add app/api/reviews/import-best-reviews/route.ts
git commit -m "feat: add POST /api/reviews/import-best-reviews endpoint"
```

---

## Task 7: Update AdScoresPanel — tabs, badges, import button

**Files:**
- Modify: `app/reviews/AdScoresPanel.tsx`

- [ ] **Step 1: Replace `USP_TABS` constant**

Find and replace the `USP_TABS` constant (currently lines 9–15):
```typescript
// Before
const USP_TABS: { key: TabOption; label: string }[] = [
  { key: "all", label: "All" },
  { key: "best-price", label: "Best Price" },
  { key: "locker", label: "The Locker" },
  { key: "satisfaction-guaranteed", label: "Satisfaction Guaranteed" },
  { key: "unscored", label: "Unscored" },
];

// After
const USP_TABS: { key: TabOption; label: string }[] = [
  { key: "all", label: "All" },
  { key: "customer-service", label: "Customer Service" },
  { key: "deals-pricing", label: "Deals & Pricing" },
  { key: "curation-quality", label: "Curation & Quality" },
  { key: "locker", label: "Locker" },
  { key: "trust-reliability", label: "Trust & Reliability" },
  { key: "experience-fun", label: "Experience & Fun" },
  { key: "best-price", label: "Best Price" },
  { key: "satisfaction-guaranteed", label: "Satisfaction Guaranteed" },
  { key: "unscored", label: "Unscored" },
];
```

- [ ] **Step 2: Replace `USP_BADGE` constant**

Find and replace the `USP_BADGE` constant (currently lines 17–27):
```typescript
const USP_BADGE: Record<UspCategory, { label: string; className: string }> = {
  "customer-service": { label: "Customer Service", className: "bg-blue-100 text-blue-800" },
  "deals-pricing": { label: "Deals & Pricing", className: "bg-green-100 text-green-800" },
  "curation-quality": { label: "Curation & Quality", className: "bg-amber-100 text-amber-800" },
  "locker": { label: "The Locker", className: "bg-indigo-100 text-indigo-800" },
  "trust-reliability": { label: "Trust & Reliability", className: "bg-teal-100 text-teal-800" },
  "experience-fun": { label: "Experience & Fun", className: "bg-pink-100 text-pink-800" },
  "best-price": { label: "Best Price", className: "bg-emerald-100 text-emerald-800" },
  "satisfaction-guaranteed": { label: "Guaranteed", className: "bg-purple-100 text-purple-800" },
};
```

- [ ] **Step 3: Add import state + handler to the component**

Inside `AdScoresPanel()`, after the existing state declarations (around line 144), add:
```typescript
const [importing, setImporting] = useState(false);
const [importResult, setImportResult] = useState<string | null>(null);
const importFileRef = useRef<HTMLInputElement>(null);
```

Also add `useRef` to the existing React import at the top of the file:
```typescript
// Before
import { useState, useEffect, useCallback } from "react";
// After
import { useState, useEffect, useCallback, useRef } from "react";
```

Add the import handler inside `AdScoresPanel()`, after `handleStar`:
```typescript
const handleImportMd = async (e: React.ChangeEvent<HTMLInputElement>) => {
  const file = e.target.files?.[0];
  if (!file) return;
  setImporting(true);
  setImportResult(null);
  try {
    const markdown = await file.text();
    const res = await fetch("/api/reviews/import-best-reviews", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brand: "winespies", markdown }),
    });
    const data = await res.json() as { inserted?: number; skipped?: number; error?: string };
    if (!res.ok) throw new Error(data.error ?? "Import failed");
    setImportResult(`Imported ${data.inserted} reviews (${data.skipped} skipped)`);
    await fetchTestimonials();
  } catch (err) {
    setImportResult(err instanceof Error ? err.message : "Import failed");
  } finally {
    setImporting(false);
    if (importFileRef.current) importFileRef.current.value = "";
  }
};
```

- [ ] **Step 4: Add import button to JSX**

In the JSX, inside the "Top bar" `<div className="flex items-center gap-3 flex-wrap">`, add after the "Score unscored" button:
```tsx
<input
  ref={importFileRef}
  type="file"
  accept=".md,text/markdown"
  onChange={handleImportMd}
  className="hidden"
/>
<button
  onClick={() => importFileRef.current?.click()}
  disabled={importing}
  className="px-3 py-1.5 text-sm rounded-lg border border-border text-muted hover:text-foreground transition-colors disabled:opacity-50"
>
  {importing ? "Importing…" : "Import MD"}
</button>
{importResult && (
  <span className="text-xs text-muted">{importResult}</span>
)}
```

- [ ] **Step 5: Commit**
```bash
git add app/reviews/AdScoresPanel.tsx
git commit -m "feat: update AdScoresPanel for 8 USP categories and add Import MD button"
```

---

## Verification

After all tasks are complete:

1. Run `npm run build` — confirm no TypeScript errors (especially around `UspCategory` exhaustiveness)
2. In the app, go to `/reviews` → "Ad Scores" tab
3. Click "Import MD", select `wine_spies_best_reviews.md`
4. Confirm toast shows "Imported N reviews (M skipped)"
5. Confirm reviews appear under each category tab
6. In any AI route that calls `getContextBundle()`, confirm the response system prompt includes `## Top Customer Testimonials` with real quotes

---

## Self-Review Notes

- `UspCategory` is stored as `String?` in Prisma — no migration needed
- The old 3 categories (`best-price`, `locker`, `satisfaction-guaranteed`) remain valid — existing scored reviews keep working
- `mergeReviewsDb` is NOT used for this import because it doesn't write scoring fields; `importBestReviewsDb` handles that directly
- Re-importing the same file is safe: content-based dedup skips existing rows
- `importBestReviews` in `reviews-storage.ts` is a no-op if `DATABASE_URL` is unset (returns `skipped: reviews.length`) — correct behaviour since file-mode has no equivalent
