# Best Reviews Import — Design Spec

**Date:** 2026-04-16
**Scope:** Import curated MD file → reviews DB. Expand USP categories. Surface in Ad Scores tab.
**Out of scope:** Ad builder auto-select (future work).

---

## Goal

Load `wine_spies_best_reviews.md` (831 hand-curated 5-star reviews) into the reviews DB so they appear in the Ad Scores tab and feed the existing testimonial context injection pipeline (`loadTopTestimonialsForContext` → `getContextBundle` → every AI prompt).

---

## USP Categories (expanded from 3 → 6)

| MD section | New slug |
|---|---|
| Customer Service | `customer-service` |
| Deals / Pricing | `deals-pricing` |
| Curation / Quality | `curation-quality` |
| Locker | `locker` |
| Trust / Reliability | `trust-reliability` |
| Experience / Fun | `experience-fun` |

Existing slugs (`best-price`, `satisfaction-guaranteed`) are retired from new imports. Existing scored reviews keep their old slugs — no migration needed.

---

## MD File Format (parser targets)

```
## Customer Service          ← section = USP category
### ⭐ Name — "Title" *(Date)*
*Also touches: ...*          ← optional, ignored

> Full review text here.     ← blockquote = content + extractedQuote
**Bolded pull quote.**       ← bold within blockquote = extractedQuote (preferred)
```

Parser rules:
- Split on `^## ` headers → current category
- Split on `^### ⭐` → individual reviews
- Author: text before ` — ` in heading
- Content: blockquote lines (strip `> ` prefix)
- `extractedQuote`: first `**...**` match in content, stripped of bold markers; fallback = first 250 chars
- `adScore`: 80 for all (hand-selected = high quality)
- `scoredAt`: import timestamp
- `source`: `"trustpilot"` (per file header)
- Dedupe: skip if a review with identical content already exists

---

## Architecture

### New files
- `lib/parse-best-reviews-md.ts` — pure parser, no I/O. Input: MD string. Output: `ParsedReview[]`.
- `app/api/reviews/import-best-reviews/route.ts` — POST endpoint. Accepts `{ brand, markdown }`. Calls parser, upserts via `mergeReviews` + `updateReviewScoring`. Returns `{ inserted, skipped }`.

### Modified files
- `lib/reviews.ts` — expand `UspCategory` union to 6 values
- `lib/reviews-storage.ts` — update `loadTopTestimonialsForContext` to iterate all 6 categories
- `lib/reviews-db.ts` — update `loadTopTestimonialsDb` category list
- `app/reviews/AdScoresPanel.tsx` — update `USP_TABS` and `USP_BADGE` for 6 categories

### Import trigger
Button on the Ad Scores tab: "Import best reviews MD". Opens a file input (`.md` only). On select, reads file as text, POSTs to `/api/reviews/import-best-reviews`. Shows `inserted / skipped` result.

---

## Data flow after import

```
wine_spies_best_reviews.md
  → POST /api/reviews/import-best-reviews
  → mergeReviews() + updateReviewScoring()
  → DB rows: uspCategory + extractedQuote + adScore=80 + scoredAt
  → loadTopTestimonialsForContext() picks top 5 per category
  → getContextBundle() injects as "## Top Customer Testimonials"
  → every AI prompt gets curated quotes automatically
```

---

## Not in scope

- Prisma schema migration (UspCategory is stored as `String?`, no migration needed)
- Ad builder auto-select UI
- Re-scoring or overwriting existing scored reviews
