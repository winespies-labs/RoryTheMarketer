# PDP Ad Builder — Cleanup & Completion Design
**Date:** 2026-04-08
**Status:** Approved

---

## Problem

The codebase has two overlapping ad builder systems:

1. **Dead Puppeteer system** — HTML templates + assembler + screenshot pipeline. Never shipped. Exists as dead code in `lib/assembler/`, `templates/`, and related API routes.
2. **Working system** — `/creative/pdp/` wizard using reference ads (style image + Gemini generation prompt). Mostly built. Missing field-mapping Review Brief and Meta publish step.

The old `/app/ad-builder/` wizard is also dead — superseded by `/creative/pdp/` but never removed.

---

## Goal

One clean pipeline:

> **Wine product feed + Reference template (style image + prompt + field schema) → Generated ads → Meta publish**

Support two workflows from a shared landing page:
- **PDP Builder** — product-feed-driven, bulk N wines × M templates
- **Creative Ad Studio** — non-product static ads (testimonials, brand, etc.) — scaffold only, content TBD

---

## What Gets Deleted

### Dead lib files
- `lib/assembler/` — entire directory (index.ts, fill-template.ts, screenshot.ts)
- `lib/template-schema.ts`
- `lib/template-product.ts`
- `lib/template-registry.ts`

### Dead API routes
- `app/api/ad-builder/assemble-brief/`
- `app/api/ad-builder/templates/`
- `app/api/creative/templates/`

### Dead app routes
- `app/ad-builder/` — entire old wizard and all components

### Dead templates
- `templates/` — entire directory (cult-dark HTML template)

### Dead Prisma models
- `PdpTemplate` — defined but never referenced in TypeScript
- `PdpGeneratedAd` — defined but never referenced in TypeScript

### Consolidate
- `app/api/pdp/generate/` — keep (used by `/creative/pdp/`)
- `app/api/pdp/styles/` — keep (used by `/creative/pdp/`)

---

## What Gets Kept

### The working template system
- `context/Examples/Ads/Static/` — reference ad markdown files + style images
- `lib/reference-ads.ts` — markdown parser + dual storage
- `app/api/ad-reference/*` — reference ad CRUD
- `ReferenceAdEntry` Postgres model — persists style images + generation prompts

### The working PDP wizard (already built)
- `app/creative/pdp/page.tsx` — 4-step wizard shell
- `app/creative/pdp/components/WineSelector.tsx` — Step 1 ✅
- `app/creative/pdp/components/StyleSelector.tsx` — Step 2 ✅
- `app/creative/pdp/components/DataReview.tsx` — Step 3 (needs upgrade)
- `app/creative/pdp/components/ResultsGrid.tsx` — Step 4 ✅
- `app/creative/pdp/hooks/useFeed.ts` ✅
- `app/creative/pdp/hooks/useStyles.ts` ✅
- `app/creative/pdp/hooks/useGenerator.ts` ✅
- `app/creative/ad-builder/_shared/wineAdContext.ts` ✅

### The landing page
- `app/creative/ad-builder/page.tsx` — two-workflow landing ✅
- `app/creative/ad-builder/studio/page.tsx` — scaffold ✅

---

## What Gets Fixed / Built

### Fix: DataReview.tsx → proper field-mapping Review Brief

Current `DataReview.tsx` shows a simple editable row per wine. It needs to become the full field-mapping table from the spec:

**Layout:** Accordion per wine. Each wine expands to show one sub-row per selected template. Each sub-row expands to show the field mapping table.

**Field mapping table columns:**

| Field | Source | Status | Value / Action |
|-------|--------|--------|----------------|
| wine_display_name | Feed | ✅ Ready | "2022 Heir Apparent..." |
| score_badge | Feed | ⚠️ Hidden | No score — badge will not render |
| headline | AI | 🤖 Will generate | — |
| cta_button | Static | 🔒 "GET THIS DEAL" | — |
| background_image | AI | 🤖 Will generate | — |

**Status indicators:**
- ✅ `ok` — resolved from feed, will render
- ⚠️ `missing_optional` — absent, element hidden per fallback
- 🤖 `ai_generated` — generated at runtime
- 🔒 `static` — hardcoded in template
- 🚫 `missing_required` — blocks generation; inline error shown

**Override capability:** Every feed-sourced field value is editable inline. Changes are local state — they do not write back to the feed.

**Top summary bar:** "X of Y ads ready to generate" with a list of any blocked combinations and why.

**Generate button:** Disabled if any required fields are missing. Shows count: "Generate 6 Ads →"

**Data contract:** Uses `resolveBatchMappings()` and `TEMPLATE_SCHEMAS` from `wineAdContext.ts`. Each reference template must have a corresponding `TemplateSchema` entry in `TEMPLATE_SCHEMAS`.

### New: Step 5 — Publish to Meta

After reviewing generated ads in the results grid:

- Show selected ads with editable Meta copy fields (headline, primary text, description — pre-populated from generated copy)
- Choose destination: new ad set or pick existing ad set from Meta account
- Each ad gets its `sale_url` auto-populated from `context.sale_url`
- Confirm → push to Meta via API
- Show success/failure per ad

---

## Route Structure (Final)

```
/creative/ad-builder              → Landing (PDP Builder | Creative Ad Studio)
/creative/ad-builder/studio       → Scaffold ("Coming Soon")
/creative/pdp                     → PDP Builder Step 1 (Wine Select)
/creative/pdp?step=2              → Step 2 (Style/Template Select)
/creative/pdp?step=3              → Step 3 (Review Brief — field mapping)
/creative/pdp?step=4              → Step 4 (Generate + Review)
/creative/pdp?step=5              → Step 5 (Publish to Meta)
```

Steps are gated. Step 3 is never skippable.

---

## Data Flow

```
GET /api/wines/current
       ↓
useFeed() → WineAdContext[] (resolved via resolveWineAdContext)
       ↓
User selects wines + reference templates
       ↓
resolveBatchMappings(selectedSales, selectedTemplateIds)
       ↓
BatchMappingResult → DataReview (field mapping table, inline edits)
       ↓
useGenerator.startBatch() — N × M parallel calls to /api/pdp/generate
  ├── Claude: buildCopyPrompt(context, schema) → headline, primary_text, description
  └── Gemini: style image + wine data → ad image (base64)
       ↓
ResultsGrid — review, regenerate individual ads, deselect
       ↓
PublishPanel — Meta copy fields, ad set selection, push
```

---

## Key Invariants

1. **No field ever defaults to a fake value.** If `has_score` is false, the score badge does not render. No "N/A", no "0".
2. **`resolveWineAdContext` runs at feed load time**, not generation time.
3. **Review Brief is never skippable.** Generate button lives on Step 3.
4. **Templates are defined in `TEMPLATE_SCHEMAS`.** No schema = no generation.
5. **Overrides are local state only.** Never written back to feed or database.

---

## Build Order

**Phase 1 — Cleanup**
1. Delete dead lib files (assembler, template-schema, template-product, template-registry)
2. Delete `templates/` directory
3. Delete `/app/ad-builder/` route
4. Delete dead API routes (assemble-brief, ad-builder/templates, creative/templates)
5. Remove `PdpTemplate` and `PdpGeneratedAd` from Prisma schema + run migration

**Phase 2 — Fix Review Brief (Step 3)**
6. Add missing `TemplateSchema` entries to `TEMPLATE_SCHEMAS` in `wineAdContext.ts` for all active reference templates
7. Rebuild `DataReview.tsx` as proper field-mapping accordion
8. Wire `useBatchMapping` hook (wraps `resolveBatchMappings`)
9. Inline override editing
10. Blocked ad warnings + Generate button gating

**Phase 3 — Publish Step (Step 5)**
11. Add Step 5 to wizard shell
12. Build `PublishPanel` component — Meta copy fields + ad set picker
13. Wire to Meta API (new or existing ad set)
14. Confirm + publish flow

**Phase 4 — Creative Ad Studio (future)**
15. Define ad format types (testimonial, benefit, brand awareness, etc.) — content TBD
16. Build studio workflow when format list is confirmed

---

## Out of Scope

- Creative Ad Studio ad format content — deferred until format list is confirmed
- Auto-generate-and-publish (no human review) — future phase
- Bulk schedule / drip publishing — future phase
