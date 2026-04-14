# Testimonials System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Enrich customer reviews with AI-generated USP categorization, ad-readiness scores, and extracted quotes — then surface them in a browseable `/testimonials` page, inject them into Claude's context bundle, and add a quote picker to the PDP ad builder.

**Architecture:** Four new nullable fields added to `CustomerReview` (Prisma + JSON file path). A batch scoring API route calls Claude in groups of 20 to populate those fields. The testimonials page and ad builder picker both read from the existing reviews storage via a new `GET /api/testimonials` route. Context bundle becomes async so it can read top testimonials from storage and inject them into every Claude prompt.

**Tech Stack:** Next.js App Router, Prisma 6 / PostgreSQL + JSON file fallback, Anthropic SDK (`claude-sonnet-4-5`), React 19, Tailwind CSS 4.

---

## File Map

| File | Action | Responsibility |
|------|--------|----------------|
| `prisma/schema.prisma` | Modify | Add 4 nullable fields to `CustomerReview` |
| `lib/reviews.ts` | Modify | Add `UspCategory` type + 4 fields to `Review` interface |
| `lib/reviews-db.ts` | Modify | Update `rowToReview`, `importJsonToDbIfEmpty`; add `updateReviewScoringDb`, `loadUnscoredReviewsDb`, `getUnscoredCountDb`, `loadTopTestimonialsDb` |
| `lib/reviews-storage.ts` | Modify | Add `updateReviewScoring`, `loadUnscoredReviews`, `getUnscoredCount`, `loadTopTestimonialsForContext` |
| `app/api/testimonials/score/route.ts` | Create | POST: batch Claude scoring of unscored reviews |
| `app/api/testimonials/route.ts` | Create | GET: filtered/sorted testimonials list + unscored count |
| `lib/context-bundle.ts` | Modify | Make `getContextBundle` async; inject top 5 testimonials per USP |
| `app/api/brief/generate/route.ts` | Modify | Add `await` to `getContextBundle` call |
| `app/api/chat/route.ts` | Modify | Add `await` to `getContextBundle` call |
| `app/api/context/bundle/route.ts` | Modify | Add `await` to `getContextBundle` call |
| `app/api/ad-reference/batch-ingest/route.ts` | Modify | Add `await` to `getContextBundle` call |
| `app/api/copywriter/route.ts` | Modify | Add `await` to `getContextBundle` call |
| `app/api/ad-reference/generate/route.ts` | Modify | Add `await` to `getContextBundle` call |
| `app/api/ad-reference/generate-full/route.ts` | Modify | Add `await` to `getContextBundle` call |
| `app/testimonials/page.tsx` | Create | Server wrapper page component |
| `app/testimonials/TestimonialsPanel.tsx` | Create | Client component: filter tabs, sort, card grid, score button |
| `app/components/AppSidebar.tsx` | Modify | Add "Testimonials" to `TOP_LINKS` |
| `app/creative/pdp/components/TestimonialsPicker.tsx` | Create | Collapsible testimonials picker for PDP DataReview step |
| `app/creative/pdp/components/DataReview.tsx` | Modify | Add `<TestimonialsPicker>` below wines accordion |

---

## Task 1: Schema Migration + TypeScript Types

**Files:**
- Modify: `prisma/schema.prisma`
- Modify: `lib/reviews.ts`

- [ ] **Step 1: Add 4 fields to `CustomerReview` in `prisma/schema.prisma`**

Find this block in `prisma/schema.prisma`:
```prisma
  starred          Boolean  @default(false)
  topics           String[] @default([])

  @@unique([brandId, slackMessageTs])
```

Replace with:
```prisma
  starred          Boolean   @default(false)
  topics           String[]  @default([])
  uspCategory      String?   @map("usp_category")
  adScore          Int?      @map("ad_score")
  extractedQuote   String?   @map("extracted_quote") @db.Text
  scoredAt         DateTime? @map("scored_at")

  @@unique([brandId, slackMessageTs])
```

- [ ] **Step 2: Run the migration**

```bash
cd /Users/mikemeisner/Developer/RoryTheMarketer && npx prisma migrate dev --name add_testimonial_fields
```

Expected output: `Your database is now in sync with your schema.` If `DATABASE_URL` is not set locally, skip this step — migration runs automatically via `prisma migrate deploy` in production.

- [ ] **Step 3: Regenerate Prisma client**

```bash
npx prisma generate
```

Expected: `✔ Generated Prisma Client`

- [ ] **Step 4: Update `lib/reviews.ts` — add `UspCategory` type and 4 new fields to `Review`**

Add after line 2 (`export type ReviewSource = ...`):
```typescript
export type UspCategory = "best-price" | "locker" | "satisfaction-guaranteed";
```

Replace the existing `Review` interface with:
```typescript
export interface Review {
  id: string;
  source: ReviewSource;
  title?: string;
  content: string;
  author?: string;
  rating?: number;
  /** When the review was created (from platform or first seen). */
  createdAt: string;
  /** Slack message ts — used to dedupe when syncing from Slack. */
  slackMessageTs?: string;
  /** Saved as a favorite in Context Hub. */
  starred?: boolean;
  /** User-assigned topics for filtering (e.g. Locker, Customer service). */
  topics?: string[];
  /** Which USP this review best supports. Null = unscored. */
  uspCategory?: UspCategory | null;
  /** Ad-readiness score 0–100. Null = unscored. */
  adScore?: number | null;
  /** AI-extracted best 1–2 sentence quote for use in ads. */
  extractedQuote?: string | null;
  /** When scoring last ran. Null = unscored. */
  scoredAt?: string | null;
}
```

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma lib/reviews.ts && git commit -m "feat(testimonials): add scoring fields to schema and Review type"
```

---

## Task 2: DB Storage Layer

**Files:**
- Modify: `lib/reviews-db.ts`

- [ ] **Step 1: Update `rowToReview` in `lib/reviews-db.ts` to include new fields**

Replace the existing `rowToReview` function (lines 7–31) with:
```typescript
function rowToReview(row: {
  id: string;
  source: string;
  title: string | null;
  content: string;
  author: string | null;
  rating: number | null;
  createdAt: Date;
  slackMessageTs: string | null;
  starred: boolean;
  topics: string[];
  uspCategory: string | null;
  adScore: number | null;
  extractedQuote: string | null;
  scoredAt: Date | null;
}): Review {
  return {
    id: row.id,
    source: row.source as ReviewSource,
    title: row.title ?? undefined,
    content: row.content,
    author: row.author ?? undefined,
    rating: row.rating ?? undefined,
    createdAt: row.createdAt.toISOString(),
    slackMessageTs: row.slackMessageTs ?? undefined,
    starred: row.starred,
    topics: row.topics?.length ? row.topics : undefined,
    uspCategory: (row.uspCategory as UspCategory | null) ?? null,
    adScore: row.adScore ?? null,
    extractedQuote: row.extractedQuote ?? null,
    scoredAt: row.scoredAt?.toISOString() ?? null,
  };
}
```

Also update the import at the top of `lib/reviews-db.ts` to include `UspCategory`:
```typescript
import type { Review, ReviewSource, ReviewsData, UspCategory } from "@/lib/reviews";
```

- [ ] **Step 2: Update `importJsonToDbIfEmpty` to write new fields from file**

In `importJsonToDbIfEmpty`, the `createMany` data block maps `r` to DB fields. Replace the `data` mapping:
```typescript
data: file.reviews.map((r) => ({
  id: r.id,
  brandId,
  source: r.source,
  title: r.title ?? null,
  content: r.content,
  author: r.author ?? null,
  rating: r.rating ?? null,
  createdAt: new Date(r.createdAt),
  slackMessageTs: r.slackMessageTs ?? null,
  starred: r.starred ?? false,
  topics: r.topics ?? [],
  uspCategory: r.uspCategory ?? null,
  adScore: r.adScore ?? null,
  extractedQuote: r.extractedQuote ?? null,
  scoredAt: r.scoredAt ? new Date(r.scoredAt) : null,
})),
```

- [ ] **Step 3: Add `updateReviewScoringDb` function at the bottom of `lib/reviews-db.ts`**

```typescript
export async function updateReviewScoringDb(
  brandId: string,
  reviewId: string,
  scoring: {
    uspCategory: UspCategory | null;
    adScore: number;
    extractedQuote: string;
  }
): Promise<void> {
  const prisma = getPrisma();
  await prisma.customerReview.updateMany({
    where: { id: reviewId, brandId },
    data: {
      uspCategory: scoring.uspCategory,
      adScore: scoring.adScore,
      extractedQuote: scoring.extractedQuote,
      scoredAt: new Date(),
    },
  });
}
```

- [ ] **Step 4: Add `loadUnscoredReviewsDb` and `getUnscoredCountDb` at the bottom of `lib/reviews-db.ts`**

```typescript
export async function loadUnscoredReviewsDb(brandId: string): Promise<Review[]> {
  const prisma = getPrisma();
  const rows = await prisma.customerReview.findMany({
    where: { brandId, scoredAt: null },
    orderBy: { createdAt: "desc" },
  });
  return rows.map(rowToReview);
}

export async function getUnscoredCountDb(brandId: string): Promise<number> {
  const prisma = getPrisma();
  return prisma.customerReview.count({ where: { brandId, scoredAt: null } });
}
```

- [ ] **Step 5: Add `loadTopTestimonialsDb` at the bottom of `lib/reviews-db.ts`**

```typescript
/** Returns top 5 scored reviews per USP category, ordered by adScore desc. */
export async function loadTopTestimonialsDb(
  brandId: string
): Promise<Review[]> {
  const prisma = getPrisma();
  const categories: UspCategory[] = ["best-price", "locker", "satisfaction-guaranteed"];
  const results = await Promise.all(
    categories.map((cat) =>
      prisma.customerReview.findMany({
        where: {
          brandId,
          uspCategory: cat,
          adScore: { not: null },
          extractedQuote: { not: null },
        },
        orderBy: { adScore: "desc" },
        take: 5,
      })
    )
  );
  return results.flat().map(rowToReview);
}
```

- [ ] **Step 6: Commit**

```bash
git add lib/reviews-db.ts && git commit -m "feat(testimonials): update DB layer for scoring fields and queries"
```

---

## Task 3: Storage Abstraction

**Files:**
- Modify: `lib/reviews-storage.ts`

- [ ] **Step 1: Update imports in `lib/reviews-storage.ts`**

Add to the existing imports from `lib/reviews-db.ts`:
```typescript
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
```

Also add `UspCategory` to the import from `lib/reviews`:
```typescript
import {
  type Review,
  type ReviewsData,
  type ReviewSource,
  type UspCategory,
} from "@/lib/reviews";
```

- [ ] **Step 2: Add `updateReviewScoring` to `lib/reviews-storage.ts`**

```typescript
function updateReviewScoringFile(
  brandId: string,
  reviewId: string,
  scoring: {
    uspCategory: UspCategory | null;
    adScore: number;
    extractedQuote: string;
  }
): void {
  const data = readReviewsFile(brandId);
  const idx = data.reviews.findIndex((r) => r.id === reviewId);
  if (idx === -1) return;
  data.reviews[idx] = {
    ...data.reviews[idx],
    uspCategory: scoring.uspCategory,
    adScore: scoring.adScore,
    extractedQuote: scoring.extractedQuote,
    scoredAt: new Date().toISOString(),
  };
  writeReviewsFile(brandId, data);
}

export async function updateReviewScoring(
  brandId: string,
  reviewId: string,
  scoring: {
    uspCategory: UspCategory | null;
    adScore: number;
    extractedQuote: string;
  }
): Promise<void> {
  if (useDatabase()) {
    await importJsonToDbIfEmpty(brandId);
    await updateReviewScoringDb(brandId, reviewId, scoring);
    return;
  }
  updateReviewScoringFile(brandId, reviewId, scoring);
}
```

- [ ] **Step 3: Add `loadUnscoredReviews` and `getUnscoredCount` to `lib/reviews-storage.ts`**

```typescript
export async function loadUnscoredReviews(brandId: string): Promise<Review[]> {
  if (useDatabase()) {
    await importJsonToDbIfEmpty(brandId);
    return loadUnscoredReviewsDb(brandId);
  }
  const data = readReviewsFile(brandId);
  return data.reviews.filter((r) => !r.scoredAt);
}

export async function getUnscoredCount(brandId: string): Promise<number> {
  if (useDatabase()) {
    await importJsonToDbIfEmpty(brandId);
    return getUnscoredCountDb(brandId);
  }
  const data = readReviewsFile(brandId);
  return data.reviews.filter((r) => !r.scoredAt).length;
}
```

- [ ] **Step 4: Add `loadTopTestimonialsForContext` to `lib/reviews-storage.ts`**

```typescript
/** Returns up to 5 top-scored reviews per USP category for context injection. */
export async function loadTopTestimonialsForContext(
  brandId: string
): Promise<Review[]> {
  if (useDatabase()) {
    await importJsonToDbIfEmpty(brandId);
    return loadTopTestimonialsDb(brandId);
  }
  const data = readReviewsFile(brandId);
  const categories: UspCategory[] = ["best-price", "locker", "satisfaction-guaranteed"];
  const results: Review[] = [];
  for (const cat of categories) {
    const scored = data.reviews
      .filter((r) => r.uspCategory === cat && r.adScore != null && r.extractedQuote)
      .sort((a, b) => (b.adScore ?? 0) - (a.adScore ?? 0))
      .slice(0, 5);
    results.push(...scored);
  }
  return results;
}
```

- [ ] **Step 5: Commit**

```bash
git add lib/reviews-storage.ts && git commit -m "feat(testimonials): add scoring abstraction functions to reviews-storage"
```

---

## Task 4: Scoring API Route

**Files:**
- Create: `app/api/testimonials/score/route.ts`

- [ ] **Step 1: Create `app/api/testimonials/score/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getBrand } from "@/lib/brands";
import type { UspCategory } from "@/lib/reviews";
import {
  loadUnscoredReviews,
  updateReviewScoring,
  getUnscoredCount,
} from "@/lib/reviews-storage";

export const maxDuration = 60;

const client = new Anthropic();

interface ScoreResult {
  id: string;
  uspCategory: UspCategory | null;
  adScore: number;
  extractedQuote: string;
}

async function scoreBatch(
  reviews: { id: string; content: string; title?: string; rating?: number }[]
): Promise<ScoreResult[]> {
  const reviewList = reviews
    .map(
      (r, i) =>
        `[${i}] ID: ${r.id}\nRating: ${r.rating ?? "unknown"}/5\n${r.title ? `Title: ${r.title}\n` : ""}Review: ${r.content.slice(0, 600)}`
    )
    .join("\n\n---\n\n");

  const msg = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 2000,
    messages: [
      {
        role: "user",
        content: `You are scoring customer reviews for Wine Spies, a wine e-commerce brand with three USPs:

1. "best-price" — We taste every wine, verify it's the lowest price on Wine-Searcher, and only sell if it meets both quality and price standards.
2. "locker" — Customers build up 1-2 bottles per order in their Locker; at 12 bottles it ships free on their schedule.
3. "satisfaction-guaranteed" — Real customer service, standing behind every purchase.

For each review below, return a JSON array with one object per review:
- "id": the review ID (copy exactly)
- "uspCategory": which USP this review best supports — "best-price", "locker", or "satisfaction-guaranteed" — or null if none clearly applies
- "adScore": 0–100 integer. Score higher for: specificity (mentions Locker, price, bottles, specific wine), quotability (excerpt stands alone), emotional resonance, brevity. 5-star reviews score higher than lower-rated ones.
- "extractedQuote": the single best 1–2 sentence excerpt from the review body, suitable to use verbatim in a Facebook ad. Must be self-contained. Max 200 characters.

Return ONLY a valid JSON array. No markdown, no explanation.

Reviews:

${reviewList}`,
      },
    ],
  });

  const text = msg.content[0].type === "text" ? msg.content[0].text : "";
  const parsed = JSON.parse(text.trim()) as ScoreResult[];
  return parsed;
}

export async function POST(req: NextRequest) {
  const brandId = req.nextUrl.searchParams.get("brand") ?? "winespies";
  if (!getBrand(brandId)) {
    return NextResponse.json({ error: "Unknown brand" }, { status: 400 });
  }

  const unscored = await loadUnscoredReviews(brandId);
  if (unscored.length === 0) {
    return NextResponse.json({ scored: 0, remaining: 0 });
  }

  const BATCH_SIZE = 20;
  let scored = 0;
  let errors = 0;

  for (let i = 0; i < unscored.length; i += BATCH_SIZE) {
    const batch = unscored.slice(i, i + BATCH_SIZE);
    try {
      const results = await scoreBatch(
        batch.map((r) => ({
          id: r.id,
          content: r.content,
          title: r.title,
          rating: r.rating,
        }))
      );
      await Promise.all(
        results.map((result) =>
          updateReviewScoring(brandId, result.id, {
            uspCategory: result.uspCategory,
            adScore: Math.max(0, Math.min(100, result.adScore)),
            extractedQuote: result.extractedQuote ?? "",
          })
        )
      );
      scored += results.length;
    } catch {
      errors += batch.length;
    }
  }

  const remaining = await getUnscoredCount(brandId);
  return NextResponse.json({ scored, errors, remaining });
}
```

- [ ] **Step 2: Verify the file builds**

```bash
cd /Users/mikemeisner/Developer/RoryTheMarketer && npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors in the new file. Build may warn about other things but should not fail on the new route.

- [ ] **Step 3: Commit**

```bash
git add app/api/testimonials/score/route.ts && git commit -m "feat(testimonials): add batch AI scoring API route"
```

---

## Task 5: Testimonials List API

**Files:**
- Create: `app/api/testimonials/route.ts`

- [ ] **Step 1: Create `app/api/testimonials/route.ts`**

```typescript
import { NextRequest, NextResponse } from "next/server";
import { getBrand } from "@/lib/brands";
import type { UspCategory } from "@/lib/reviews";
import { listReviewsForApi, getUnscoredCount } from "@/lib/reviews-storage";

function parseBool(v: string | null): boolean {
  return v === "1" || v === "true" || v === "yes";
}

export async function GET(req: NextRequest) {
  const brandId = req.nextUrl.searchParams.get("brand") ?? "winespies";
  if (!getBrand(brandId)) {
    return NextResponse.json({ error: "Unknown brand" }, { status: 400 });
  }

  const uspCategory =
    (req.nextUrl.searchParams.get("uspCategory") as UspCategory | null) ??
    undefined;
  const starredOnly = parseBool(req.nextUrl.searchParams.get("starred"));
  const sort = req.nextUrl.searchParams.get("sort") ?? "score";
  const unscoredOnly = parseBool(req.nextUrl.searchParams.get("unscored"));
  const limit = Math.min(
    Math.max(
      Number.parseInt(req.nextUrl.searchParams.get("limit") ?? "60", 10) || 60,
      1
    ),
    200
  );
  const offset = Math.max(
    Number.parseInt(req.nextUrl.searchParams.get("offset") ?? "0", 10) || 0,
    0
  );

  // Re-use the existing listReviewsForApi with topic filter mapped to uspCategory
  // For unscored tab we pass a sentinel — the storage layer doesn't filter by scoredAt yet,
  // so we fetch all and filter in the route for now.
  const { page: allPage, storeTotal } = await listReviewsForApi(brandId, {
    starredOnly,
    limit: 1000, // fetch all then filter — testimonials dataset is small
    offset: 0,
  });

  // Apply testimonials-specific filters
  let filtered = allPage;

  if (unscoredOnly) {
    filtered = filtered.filter((r) => !r.scoredAt);
  } else if (uspCategory) {
    filtered = filtered.filter((r) => r.uspCategory === uspCategory);
  } else {
    // "All" tab — show scored reviews only in the main view
    filtered = filtered.filter((r) => r.scoredAt != null);
  }

  // Sort
  if (sort === "score") {
    filtered = filtered.sort((a, b) => (b.adScore ?? 0) - (a.adScore ?? 0));
  } else if (sort === "rating") {
    filtered = filtered.sort((a, b) => (b.rating ?? 0) - (a.rating ?? 0));
  } else {
    // date
    filtered = filtered.sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    );
  }

  const matchCount = filtered.length;
  const page = filtered.slice(offset, offset + limit);

  const unscoredCount = await getUnscoredCount(brandId);

  return NextResponse.json({
    testimonials: page,
    storeTotal,
    matchCount,
    unscoredCount,
    offset,
    limit,
    hasMore: offset + page.length < matchCount,
  });
}
```

- [ ] **Step 2: Commit**

```bash
git add app/api/testimonials/route.ts && git commit -m "feat(testimonials): add testimonials list API route"
```

---

## Task 6: Context Bundle — Async + Testimonials Injection

**Files:**
- Modify: `lib/context-bundle.ts`
- Modify: `app/api/brief/generate/route.ts`
- Modify: `app/api/chat/route.ts`
- Modify: `app/api/context/bundle/route.ts`
- Modify: `app/api/ad-reference/batch-ingest/route.ts`
- Modify: `app/api/copywriter/route.ts`
- Modify: `app/api/ad-reference/generate/route.ts`
- Modify: `app/api/ad-reference/generate-full/route.ts`

- [ ] **Step 1: Update `lib/context-bundle.ts` — make async, add testimonials**

Replace the entire file with:
```typescript
import fs from "fs";
import path from "path";
import { getBrandContextDir } from "./brands";
import { readReviewThemes } from "./review-themes-storage";
import { readMetaCommentThemes } from "./meta-comments-storage";
import { loadTopTestimonialsForContext } from "./reviews-storage";
import type { UspCategory } from "./reviews";

function readMarkdownFile(filePath: string): string {
  if (!fs.existsSync(filePath)) return "";
  return fs.readFileSync(filePath, "utf-8").trim();
}

export interface ContextBundle {
  brand: string;
  voice: string;
  personas: string;
  usps: string;
  wineCopyGuidance: string;
  abTestLearnings: string;
  videoBrief: string;
  videoCreative: string;
  imagePromptModifier: string;
  reviewThemes: string;
  metaCommentThemes: string;
  testimonials: string;
}

const USP_LABELS: Record<UspCategory, string> = {
  "best-price": "Best Price",
  "locker": "The Locker",
  "satisfaction-guaranteed": "Satisfaction Guaranteed",
};

export async function getContextBundle(brandId: string): Promise<ContextBundle> {
  const dir = getBrandContextDir(brandId);

  const reviewThemes = readReviewThemes(brandId);
  const commentThemes = readMetaCommentThemes(brandId);
  const topTestimonials = await loadTopTestimonialsForContext(brandId);

  // Format testimonials grouped by USP
  let testimonialsText = "";
  if (topTestimonials.length > 0) {
    const byUsp = new Map<UspCategory, typeof topTestimonials>();
    for (const t of topTestimonials) {
      if (!t.uspCategory) continue;
      const group = byUsp.get(t.uspCategory) ?? [];
      group.push(t);
      byUsp.set(t.uspCategory, group);
    }
    const sections: string[] = [];
    for (const [usp, reviews] of byUsp) {
      const label = USP_LABELS[usp];
      const quotes = reviews
        .filter((r) => r.extractedQuote)
        .map((r) => `  - "${r.extractedQuote}"${r.author ? ` — ${r.author}` : ""}`)
        .join("\n");
      if (quotes) sections.push(`### ${label}\n${quotes}`);
    }
    testimonialsText = sections.join("\n\n");
  }

  return {
    brand: brandId,
    voice: readMarkdownFile(path.join(dir, "voice-guidelines.md")),
    personas: readMarkdownFile(path.join(dir, "personas.md")),
    usps: readMarkdownFile(path.join(dir, "usps.md")),
    wineCopyGuidance: readMarkdownFile(path.join(dir, "wine-copy-guidance.md")),
    abTestLearnings: readMarkdownFile(path.join(dir, "ab-test-learnings.md")),
    videoBrief: readMarkdownFile(path.join(dir, "video_brief.md")),
    videoCreative: readMarkdownFile(path.join(dir, "video-creative.md")),
    imagePromptModifier: readMarkdownFile(path.join(dir, "image-prompt-modifier.md")),
    reviewThemes: reviewThemes?.summary ?? "",
    metaCommentThemes: commentThemes?.summary ?? "",
    testimonials: testimonialsText,
  };
}

export function formatContextForPrompt(bundle: ContextBundle): string {
  const sections: string[] = [];

  if (bundle.voice) {
    sections.push(`## Brand Voice\n\n${bundle.voice}`);
  }
  if (bundle.personas) {
    sections.push(`## Target Personas\n\n${bundle.personas}`);
  }
  if (bundle.usps) {
    sections.push(`## Unique Selling Propositions\n\n${bundle.usps}`);
  }
  if (bundle.wineCopyGuidance) {
    sections.push(`## Wine Copy Guidance\n\n${bundle.wineCopyGuidance}`);
  }
  if (bundle.abTestLearnings) {
    sections.push(`## A/B Test Learnings\n\n${bundle.abTestLearnings}`);
  }
  if (bundle.reviewThemes) {
    sections.push(`## Customer Review Themes\n\nThese are recurring themes from real customer reviews (Trustpilot and App Store). Use these insights for copy, positioning, and objection handling.\n\n${bundle.reviewThemes}`);
  }
  if (bundle.metaCommentThemes) {
    sections.push(`## Ad Comment Themes\n\nThese are recurring themes from comments on the brand's Meta ads. Use these to understand audience reactions and objections.\n\n${bundle.metaCommentThemes}`);
  }
  if (bundle.testimonials) {
    sections.push(`## Top Customer Testimonials\n\nHigh-scoring real customer quotes organized by USP. Use these verbatim or as inspiration for social proof in copy.\n\n${bundle.testimonials}`);
  }

  return sections.join("\n\n---\n\n");
}
```

- [ ] **Step 2: Add `await` to `app/api/brief/generate/route.ts`**

Find `const bundle = getContextBundle(brandId);` and change to:
```typescript
const bundle = await getContextBundle(brandId);
```

- [ ] **Step 3: Add `await` to `app/api/chat/route.ts`**

Find `const bundle = getContextBundle(brandId);` and change to:
```typescript
const bundle = await getContextBundle(brandId);
```

- [ ] **Step 4: Add `await` to `app/api/context/bundle/route.ts`**

Find `const bundle = getContextBundle(brandId);` and change to:
```typescript
const bundle = await getContextBundle(brandId);
```

- [ ] **Step 5: Add `await` to `app/api/ad-reference/batch-ingest/route.ts`**

Find `const bundle = getContextBundle(brandId);` and change to:
```typescript
const bundle = await getContextBundle(brandId);
```

- [ ] **Step 6: Add `await` to `app/api/copywriter/route.ts`**

Find `const bundle = getContextBundle(brandId);` and change to:
```typescript
const bundle = await getContextBundle(brandId);
```

- [ ] **Step 7: Add `await` to `app/api/ad-reference/generate/route.ts`**

Find `const bundle = getContextBundle(brandId);` and change to:
```typescript
const bundle = await getContextBundle(brandId);
```

- [ ] **Step 8: Add `await` to `app/api/ad-reference/generate-full/route.ts`**

Find `const bundle = getContextBundle(brandId);` and change to:
```typescript
const bundle = await getContextBundle(brandId);
```

- [ ] **Step 9: Verify the build passes**

```bash
npm run build 2>&1 | tail -30
```

Expected: build completes without TypeScript errors. Any "Type error: ... is not assignable" about `getContextBundle` means a caller was missed — fix by adding `await`.

- [ ] **Step 10: Commit**

```bash
git add lib/context-bundle.ts app/api/brief/generate/route.ts app/api/chat/route.ts app/api/context/bundle/route.ts app/api/ad-reference/batch-ingest/route.ts app/api/copywriter/route.ts app/api/ad-reference/generate/route.ts app/api/ad-reference/generate-full/route.ts && git commit -m "feat(testimonials): make getContextBundle async, inject top testimonials into every Claude prompt"
```

---

## Task 7: Testimonials Page

**Files:**
- Create: `app/testimonials/page.tsx`
- Create: `app/testimonials/TestimonialsPanel.tsx`

- [ ] **Step 1: Create `app/testimonials/page.tsx`**

```typescript
import TestimonialsPanel from "./TestimonialsPanel";

export default function TestimonialsPage() {
  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-semibold text-foreground mb-1">
        Testimonials
      </h1>
      <p className="text-sm text-muted mb-6">
        Customer reviews scored for ad-readiness, categorized by USP, and extracted for use in copy and ads. Syncs daily from Slack.
      </p>
      <TestimonialsPanel />
    </div>
  );
}
```

- [ ] **Step 2: Create `app/testimonials/TestimonialsPanel.tsx`**

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";
import type { Review, UspCategory } from "@/lib/reviews";

type SortOption = "score" | "date" | "rating";
type TabOption = "all" | UspCategory | "unscored";

const USP_TABS: { key: TabOption; label: string }[] = [
  { key: "all", label: "All" },
  { key: "best-price", label: "Best Price" },
  { key: "locker", label: "The Locker" },
  { key: "satisfaction-guaranteed", label: "Satisfaction Guaranteed" },
  { key: "unscored", label: "Unscored" },
];

const USP_BADGE: Record<UspCategory, { label: string; className: string }> = {
  "best-price": {
    label: "Best Price",
    className: "bg-green-100 text-green-800",
  },
  locker: { label: "The Locker", className: "bg-blue-100 text-blue-800" },
  "satisfaction-guaranteed": {
    label: "Guaranteed",
    className: "bg-purple-100 text-purple-800",
  },
};

function StarRating({ rating }: { rating?: number | null }) {
  if (!rating) return null;
  return (
    <span className="text-yellow-500 text-xs">
      {"★".repeat(rating)}
      {"☆".repeat(5 - rating)}
    </span>
  );
}

function TestimonialCard({
  review,
  onStar,
}: {
  review: Review;
  onStar: (id: string, starred: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const uspBadge =
    review.uspCategory ? USP_BADGE[review.uspCategory] : null;

  const handleCopy = async () => {
    const text = review.extractedQuote ?? review.content.slice(0, 200);
    await navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-5 flex flex-col gap-3">
      {/* Quote */}
      <p className="text-sm font-medium text-foreground leading-relaxed">
        {review.extractedQuote ? (
          <>"{review.extractedQuote}"</>
        ) : (
          <span className="text-muted italic">
            {review.content.slice(0, 200)}
            {review.content.length > 200 ? "…" : ""}
          </span>
        )}
      </p>

      {/* Meta row */}
      <div className="flex items-center gap-2 flex-wrap">
        {review.author && (
          <span className="text-xs text-muted">— {review.author}</span>
        )}
        <StarRating rating={review.rating} />
        {uspBadge && (
          <span
            className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${uspBadge.className}`}
          >
            {uspBadge.label}
          </span>
        )}
        {review.adScore != null ? (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-accent/10 text-accent">
            {review.adScore}
          </span>
        ) : (
          <span className="text-[11px] text-muted italic">Not yet scored</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-border/40">
        <button
          onClick={handleCopy}
          className="text-xs text-muted hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-background"
        >
          {copied ? "Copied!" : "Copy quote"}
        </button>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-muted hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-background"
        >
          {expanded ? "Hide review" : "Full review"}
        </button>
        <div className="flex-1" />
        <button
          onClick={() => onStar(review.id, !review.starred)}
          className={`text-sm transition-colors ${
            review.starred ? "text-yellow-500" : "text-muted hover:text-yellow-500"
          }`}
          title={review.starred ? "Unstar" : "Star"}
        >
          {review.starred ? "★" : "☆"}
        </button>
      </div>

      {expanded && (
        <p className="text-xs text-muted leading-relaxed border-t border-border/40 pt-3">
          {review.content}
        </p>
      )}
    </div>
  );
}

export default function TestimonialsPanel() {
  const [tab, setTab] = useState<TabOption>("all");
  const [sort, setSort] = useState<SortOption>("score");
  const [starredOnly, setStarredOnly] = useState(false);
  const [testimonials, setTestimonials] = useState<Review[]>([]);
  const [unscoredCount, setUnscoredCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(false);

  const fetchTestimonials = useCallback(async () => {
    setLoading(true);
    const params = new URLSearchParams({ brand: "winespies", sort });
    if (tab === "unscored") params.set("unscored", "1");
    else if (tab !== "all") params.set("uspCategory", tab);
    if (starredOnly) params.set("starred", "1");
    params.set("limit", "200");

    const res = await fetch(`/api/testimonials?${params}`);
    if (!res.ok) { setLoading(false); return; }
    const data = await res.json() as {
      testimonials: Review[];
      unscoredCount: number;
    };
    setTestimonials(data.testimonials);
    setUnscoredCount(data.unscoredCount);
    setLoading(false);
  }, [tab, sort, starredOnly]);

  useEffect(() => { fetchTestimonials(); }, [fetchTestimonials]);

  const handleScore = async () => {
    setScoring(true);
    await fetch("/api/testimonials/score?brand=winespies", { method: "POST" });
    setScoring(false);
    await fetchTestimonials();
  };

  const handleStar = async (id: string, starred: boolean) => {
    setTestimonials((prev) =>
      prev.map((t) => (t.id === id ? { ...t, starred } : t))
    );
    await fetch(`/api/reviews/${id}?brand=winespies`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ starred }),
    });
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Top bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handleScore}
          disabled={scoring || unscoredCount === 0}
          className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors ${
            unscoredCount > 0 && !scoring
              ? "bg-accent text-white hover:bg-accent/90"
              : "bg-border text-muted cursor-not-allowed"
          }`}
        >
          {scoring ? "Scoring…" : "Score unscored"}
          {unscoredCount > 0 && !scoring && (
            <span className="bg-white/20 text-white text-[11px] font-bold px-1.5 py-0.5 rounded-full">
              {unscoredCount}
            </span>
          )}
        </button>

        <div className="flex-1" />

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOption)}
          className="text-sm border border-border rounded-lg px-3 py-1.5 bg-surface text-foreground"
        >
          <option value="score">Sort: Score</option>
          <option value="date">Sort: Date</option>
          <option value="rating">Sort: Rating</option>
        </select>

        <button
          onClick={() => setStarredOnly((v) => !v)}
          className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
            starredOnly
              ? "border-accent bg-accent/10 text-accent"
              : "border-border text-muted hover:text-foreground"
          }`}
        >
          ★ Starred only
        </button>
      </div>

      {/* USP filter tabs */}
      <div className="flex gap-1 flex-wrap">
        {USP_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              tab === t.key
                ? "bg-accent text-white font-medium"
                : "text-muted hover:text-foreground hover:bg-background"
            }`}
          >
            {t.label}
            {t.key === "unscored" && unscoredCount > 0 && (
              <span className="ml-1.5 text-[11px] font-bold bg-white/20 text-current px-1.5 py-0.5 rounded-full">
                {unscoredCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Cards */}
      {loading ? (
        <div className="text-sm text-muted py-8 text-center">Loading…</div>
      ) : testimonials.length === 0 ? (
        <div className="text-sm text-muted py-8 text-center">
          {tab === "unscored"
            ? "All reviews have been scored."
            : "No testimonials found. Score unscored reviews to populate this view."}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t) => (
            <TestimonialCard key={t.id} review={t} onStar={handleStar} />
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 3: Verify the page renders**

Run `npm run dev`, navigate to `http://localhost:3000/testimonials`. Expected: page loads with "Testimonials" heading, filter tabs, and either empty state or scored reviews.

- [ ] **Step 4: Commit**

```bash
git add app/testimonials/page.tsx app/testimonials/TestimonialsPanel.tsx && git commit -m "feat(testimonials): add testimonials page with filter tabs, sort, and score button"
```

---

## Task 8: Nav Link

**Files:**
- Modify: `app/components/AppSidebar.tsx`

- [ ] **Step 1: Add "Testimonials" to `TOP_LINKS` in `AppSidebar.tsx`**

Find:
```typescript
const TOP_LINKS: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Reviews", href: "/reviews" },
];
```

Replace with:
```typescript
const TOP_LINKS: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Reviews", href: "/reviews" },
  { label: "Testimonials", href: "/testimonials" },
];
```

- [ ] **Step 2: Commit**

```bash
git add app/components/AppSidebar.tsx && git commit -m "feat(testimonials): add Testimonials nav link"
```

---

## Task 9: Ad Builder Picker

**Files:**
- Create: `app/creative/pdp/components/TestimonialsPicker.tsx`
- Modify: `app/creative/pdp/components/DataReview.tsx`

- [ ] **Step 1: Create `app/creative/pdp/components/TestimonialsPicker.tsx`**

```typescript
"use client";

import { useState, useEffect } from "react";
import type { Review, UspCategory } from "@/lib/reviews";

interface TestimonialsPickerProps {
  /** Called with the selected quote when user picks a testimonial */
  onSelect: (quote: string) => void;
}

const USP_LABELS: Record<UspCategory, string> = {
  "best-price": "Best Price",
  locker: "The Locker",
  "satisfaction-guaranteed": "Satisfaction Guaranteed",
};

export default function TestimonialsPicker({ onSelect }: TestimonialsPickerProps) {
  const [open, setOpen] = useState(false);
  const [testimonials, setTestimonials] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!open || testimonials.length > 0) return;
    setLoading(true);
    fetch("/api/testimonials?brand=winespies&sort=score&limit=15")
      .then((r) => r.json())
      .then((data: { testimonials: Review[] }) => {
        setTestimonials(data.testimonials);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [open, testimonials.length]);

  const handleSelect = (quote: string) => {
    setSelected(quote);
    onSelect(quote);
  };

  return (
    <div className="border border-border/40 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-background hover:bg-surface transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            Testimonial Quote
          </span>
          {selected && (
            <span className="text-xs text-success font-medium">✓ Selected</span>
          )}
        </div>
        <svg
          className={`w-3.5 h-3.5 text-muted transition-transform ${open ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-2 flex flex-col gap-2">
          <p className="text-xs text-muted mb-1">
            Select a testimonial to include as social proof in the generated copy.
            Applies to all wines in this batch.
          </p>

          {loading && (
            <div className="text-xs text-muted py-2">Loading…</div>
          )}

          {!loading && testimonials.length === 0 && (
            <div className="text-xs text-muted py-2">
              No scored testimonials yet. Visit the{" "}
              <a href="/testimonials" className="text-accent hover:underline" target="_blank" rel="noreferrer">
                Testimonials page
              </a>{" "}
              to score reviews.
            </div>
          )}

          {!loading && testimonials.length > 0 && (
            <>
              {selected && (
                <button
                  type="button"
                  onClick={() => { setSelected(null); onSelect(""); }}
                  className="text-xs text-muted hover:text-danger transition-colors self-start"
                >
                  ✕ Clear selection
                </button>
              )}
              <div className="flex flex-col gap-2">
                {testimonials.map((t) => {
                  const quote = t.extractedQuote ?? t.content.slice(0, 200);
                  const isSelected = selected === quote;
                  return (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => handleSelect(quote)}
                      className={`text-left p-3 rounded-lg border text-xs leading-relaxed transition-colors ${
                        isSelected
                          ? "border-accent bg-accent/10 text-foreground"
                          : "border-border/40 hover:border-accent/50 hover:bg-surface text-foreground"
                      }`}
                    >
                      <span className="block mb-1">"{quote}"</span>
                      <span className="text-muted">
                        {t.author && `— ${t.author} · `}
                        {t.uspCategory && (
                          <span className="font-medium">{USP_LABELS[t.uspCategory]}</span>
                        )}
                        {t.adScore != null && (
                          <span className="ml-1 text-accent font-medium">{t.adScore}</span>
                        )}
                      </span>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Update `DataReview.tsx` to import and render `TestimonialsPicker`**

Add import at the top of `app/creative/pdp/components/DataReview.tsx`:
```typescript
import TestimonialsPicker from "./TestimonialsPicker";
```

In `DataReview`, the `onOverride` prop has signature `(saleId: number, field: keyof WineOverrides, value: string)`. We need to set `pullQuote` for all wines. Add a handler inside `DataReview`:

Find the closing `</div>` of `<div className="flex flex-col gap-3">` block containing the `batch.wines.map(...)` (around line 326–336), then add the picker after it.

Replace:
```tsx
      <div className="flex flex-col gap-3">
        {batch.wines.map((ctx) => (
          <WineAccordionRow
            key={ctx.sale_id}
            saleId={ctx.sale_id}
            batch={batch}
            overrides={overrides[ctx.sale_id] ?? {}}
            onOverride={(field, value) => onOverride(ctx.sale_id, field, value)}
          />
        ))}
      </div>
    </div>
```

With:
```tsx
      <div className="flex flex-col gap-3">
        {batch.wines.map((ctx) => (
          <WineAccordionRow
            key={ctx.sale_id}
            saleId={ctx.sale_id}
            batch={batch}
            overrides={overrides[ctx.sale_id] ?? {}}
            onOverride={(field, value) => onOverride(ctx.sale_id, field, value)}
          />
        ))}
      </div>

      <TestimonialsPicker
        onSelect={(quote) => {
          batch.wines.forEach((ctx) =>
            onOverride(ctx.sale_id, "pullQuote", quote)
          );
        }}
      />
    </div>
```

- [ ] **Step 3: Verify the build passes**

```bash
npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors.

- [ ] **Step 4: Manual verify in browser**

Run `npm run dev`, navigate to `http://localhost:3000/creative/pdp`, select a wine and style, advance to Step 3 (Review Brief). Expected: a collapsible "Testimonial Quote" section appears below the wine accordion rows. Opening it shows top scored testimonials (or empty state if none scored yet).

- [ ] **Step 5: Commit**

```bash
git add app/creative/pdp/components/TestimonialsPicker.tsx app/creative/pdp/components/DataReview.tsx && git commit -m "feat(testimonials): add testimonials picker to PDP ad builder brief step"
```

---

## Self-Review

### Spec Coverage

| Spec requirement | Task |
|-----------------|------|
| 4 new fields on CustomerReview (Prisma + JSON) | Task 1 + Task 2 |
| AI scoring API — batches of 20, Claude structured output | Task 4 |
| USP categorization (best-price, locker, satisfaction-guaranteed) | Tasks 1, 4, 5 |
| Ad-readiness score 0–100 | Tasks 1, 4 |
| Extracted quote 1–2 sentences | Tasks 1, 4 |
| `scoredAt` for re-run tracking | Tasks 1, 2, 3 |
| `POST /api/testimonials/score` | Task 4 |
| `/testimonials` page with filter tabs | Task 7 |
| Sort by score/date/rating | Tasks 5, 7 |
| Starred-only toggle | Tasks 5, 7 |
| Card: extracted quote, author, rating, USP badge, ad score, star, copy, expand | Task 7 |
| "Score unscored" button with count badge + loading state | Task 7 |
| Page refreshes on complete | Task 7 |
| Unscored tab shows unscored reviews | Tasks 5, 7 |
| Context bundle: top 5 per USP injected | Tasks 3, 6 |
| All Claude callers updated for async bundle | Task 6 |
| Ad builder testimonials picker | Task 9 |
| Picker applies to all wines in batch via pullQuote | Task 9 |
| Nav link | Task 8 |

All spec requirements covered.

### Type Consistency

- `UspCategory` defined in `lib/reviews.ts` (Task 1), imported in `lib/reviews-db.ts`, `lib/reviews-storage.ts`, `lib/context-bundle.ts`, `app/api/testimonials/score/route.ts`, `app/api/testimonials/route.ts`, `app/testimonials/TestimonialsPanel.tsx`, `app/creative/pdp/components/TestimonialsPicker.tsx`
- `updateReviewScoring` signature matches across `reviews-db.ts` → `reviews-storage.ts` → scoring route
- `loadTopTestimonialsForContext` used in `context-bundle.ts`, returns `Review[]` — consistent
- `onOverride` in DataReview: `(saleId: number, field: keyof WineOverrides, value: string)` — picker calls it correctly with `"pullQuote"` as field key, which is `keyof WineOverrides` ✓
