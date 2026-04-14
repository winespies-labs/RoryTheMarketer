# Testimonials System — Design Spec

**Date:** 2026-04-14
**Status:** Approved

## Overview

A testimonials system built on top of the existing customer reviews infrastructure. Reviews sync automatically from Slack daily (already running via `lib/reviews-slack-cron.ts`). This system adds AI-powered scoring and USP categorization on top of that data, a dedicated browseable `/testimonials` page, and integration with the ad builder and context bundle so testimonials actively drive copy generation.

Testimonials are not a separate data model — they are the same `CustomerReview` records, enriched with scoring fields.

## Data Model

Four new fields added to `CustomerReview` in `prisma/schema.prisma`:

| Field | Type | Description |
|-------|------|-------------|
| `uspCategory` | `String?` | One of `"best-price"`, `"locker"`, `"satisfaction-guaranteed"`, or null (unscored) |
| `adScore` | `Int?` | 0–100 composite ad-readiness score. Null = unscored |
| `extractedQuote` | `String?` | AI-pulled best 1–2 sentence snippet suitable for use in ads |
| `scoredAt` | `DateTime?` | Timestamp of last scoring run. Used to identify unscored reviews and support re-runs |

The JSON file fallback (`data/winespies/reviews.json`) gets the same fields added to each review object.

## AI Scoring Pipeline

**Route:** `POST /api/testimonials/score`

Processes all reviews where `scoredAt` is null in batches of 20. Each batch is a single Claude call using structured JSON output. The prompt includes the three Wine Spies USPs from `context/usps.md` and asks Claude to return for each review:

- `uspCategory` — which USP the review best supports (or null if none clearly applies)
- `adScore` — 0 to 100, weighted by:
  - **Specificity** — mentions Locker, price, bottle count, specific wine, etc.
  - **Quotability** — does a short excerpt stand alone without context?
  - **Emotional resonance** — conveys genuine feeling vs. generic praise
  - **Brevity** — shorter reviews score higher (more ad-usable)
  - **Rating** — 5-star reviews weighted up
- `extractedQuote` — the single best 1–2 sentence excerpt from the review body

Triggered manually from the testimonials page UI via the "Score unscored" button. Can be re-run at any time. To re-score existing reviews (e.g., after USP changes), reset `scoredAt` to null and re-trigger.

Reviews synced via the daily Slack cron will have `scoredAt = null` until the next manual score run.

## Testimonials Page (`/testimonials`)

A dedicated page separate from `/reviews`, focused on marketing use rather than raw analysis.

### Top Bar

- **"Score unscored" button** — triggers `POST /api/testimonials/score`. Shows a count badge of unscored reviews. Displays a loading state while running; page refreshes automatically when complete.
- **USP filter tabs:** All | Best Price | The Locker | Satisfaction Guaranteed | Unscored
- **Sort dropdown:** Score (default) | Date | Rating
- **Starred-only toggle**

### Review Cards (2–3 column grid)

Each card displays:
- Extracted quote in large text (the punchy AI-pulled snippet, not the full review)
- Author name + star rating
- USP badge (color-coded per category)
- Ad score badge (numeric, e.g. "87")
- Star button (favorites — uses existing `starred` field)
- "Copy quote" button (copies extracted quote to clipboard)
- Expandable full review text (collapsed by default)

Unscored reviews show the full review text and a "Not yet scored" indicator in place of USP badge and score.

## Context Bundle Integration

`lib/context-bundle.ts` → `getContextBundle()` is updated to include testimonials. It reads the top 5 highest-scoring reviews per USP category from storage and injects them into the bundle as a `testimonials` section.

This means Claude has curated social proof available in every AI call across the app — ad builder, copywriter, briefs, chat — without any per-feature wiring. The testimonials context updates automatically as scores change.

## Ad Builder Integration

In the ad builder's copy generation step, a collapsible "Testimonials" panel shows the top extracted quotes relevant to the ad's USP focus.

- The panel auto-filters by USP — a Locker ad shows top Locker testimonials first
- Clicking a quote adds it to the copy brief as a social proof anchor
- Claude weaves the quote into generated copy rather than the user having to copy-paste

The panel pulls from the same scored reviews data — no separate API call needed.

## File Changelist

| File | Change |
|------|--------|
| `prisma/schema.prisma` | Add 4 fields to `CustomerReview` |
| `lib/reviews.ts` | Add fields to `Review` TypeScript type |
| `lib/reviews-db.ts` | Update read/write to include new fields |
| `lib/reviews-file.ts` | Update read/write to include new fields |
| `app/api/testimonials/score/route.ts` | New — batch scoring route |
| `app/testimonials/page.tsx` | New — testimonials page |
| `app/testimonials/TestimonialsPanel.tsx` | New — client component |
| `lib/context-bundle.ts` | Inject top testimonials per USP |
| `app/ad-builder/` | Add testimonials picker panel to copy step |
| `app/globals.css` | USP badge color variables if needed |
