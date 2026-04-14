# Creative Ad Studio — Design Spec

**Date:** 2026-04-14
**Status:** Approved

## Overview

A brand-level static ad creation tool at `/creative/ad-builder/studio`. Unlike the PDP builder (wine-feed driven, product-specific), the Creative Ad Studio creates brand ads — USPs, testimonials, lifestyle, offers — using content from the context hub and reviews system.

The foundation is a library of reference ad templates ingested from `context/Examples/Ads/Static/`. Each template carries a fully-baked Gemini image generation prompt (with Wine Spies brand modifier pre-applied) and a nano-banana angle that drives copy generation. The user picks a style, configures content, and generates a finished ad.

---

## Sub-project 1: Ingestion Pipeline

### 1a. Enhanced Claude Vision Route

**New route:** `POST /api/ad-reference/generate-full`

Accepts a multipart form upload (`image` file). Returns a full structured JSON object ready to write as a reference ad markdown file:

```typescript
interface GenerateFullResult {
  label: string;              // e.g. "Dark Lifestyle — USP Overlay"
  angle: "usp" | "testimonial" | "lifestyle" | "offer";
  nanoBanana: string;         // Core angle/promise this layout is designed for
  adDescription: string;      // Visual layout description
  generationPrompt: string;   // Full Gemini prompt — brand modifier pre-applied, {{tokens}} for dynamic content
  promptOverrides: {
    numberOfVariations: number;
    ctaStyle?: string;
  };
  notes: string;              // Claude's observations about the template
}
```

**Claude system prompt for this route has three components:**

1. **Brand modifier** — pulled from Wine Spies context hub at request time via `getContextBundle()`. Describes visual identity: colors, typography, photography direction, mood. Prepended verbatim to every Gemini prompt Claude writes.

2. **Nano-Banana framework** — instructs Claude to identify what angle this template is optimized for (USP, testimonial, lifestyle, offer) and write a `nanoBanana` that describes the core promise/angle in one line.

3. **Token rules** — instructs Claude to use these exact placeholders for dynamic content in the Gemini prompt:

| Token | Used for |
|-------|----------|
| `{{headline}}` | Main headline text |
| `{{primaryText}}` | Body copy / quote |
| `{{ctaText}}` | CTA button label |
| `{{reviewerName}}` | Reviewer attribution (testimonial ads) |
| `{{stars}}` | Star rating display (testimonial ads) |
| `{{usp}}` | USP statement (USP ads) |

No bottle image upload token — bottle images live in brand assets in the context hub and are referenced directly in the stored prompt text when a specific layout calls for one.

### 1b. Batch Ingest Route

**New route:** `POST /api/ad-reference/batch-ingest`

Server-side only. Scans `context/Examples/Ads/Static/` for image files (`.webp`, `.png`, `.jpg`) that do not have a corresponding `.md` file. For each unregistered image:

1. Reads the image file, converts to base64
2. Calls the `generate-full` Claude Vision logic (same as 1a, reused internally)
3. Assigns a generated `id` (`winespies_studio_<slug>`) and sets `brand: winespies`, `platform: meta`, `format: static_image`, `promptTemplateId: nano-banana-studio`
4. Writes the markdown file to the same directory

Returns `{ created: string[], skipped: string[], errors: string[] }`.

Called once to ingest the 14 existing images. Triggered by a **"Ingest unregistered images"** button shown in StylePicker when unregistered images are detected (i.e. when image files exist in the static folder without a matching `.md` file).

### 1c. Ongoing Upload Flow

In the Creative Ad Studio (Step 1 style picker), an **"Add Template"** card at the end of the grid opens an upload form:
- Image upload field
- Name field (pre-filled from Claude's suggested label, editable)
- Auto-generated prompt displayed for review/edit before saving
- Save button calls `POST /api/ad-reference/create` (existing route)

This reuses the same `generate-full` route, giving the user a chance to review what Claude generated before committing.

---

## Sub-project 2: Creative Ad Studio

**Route:** `app/creative/ad-builder/studio/`

Replaces the current "coming soon" stub. Four-step wizard.

### Step 1: Pick Style

Grid of reference ad cards. Each card shows:
- The reference ad image (base64 inline, same as StyleSelector in PDP builder)
- Label
- Angle badge: `USP` / `Testimonial` / `Lifestyle` / `Offer` (colored pill)

Filtered to `brand: winespies` and `type` in `["usp", "testimonial", "lifestyle", "offer", "ugc", "comparison"]` — explicitly excludes `pdp`. An "Add Template" card at the end triggers the upload flow (1c).

### Step 2: Configure Content

Adapts based on the selected style's `angle` field:

**USP angle:**
- Shows a dropdown/list of USPs pulled from the context hub
- User selects one (or edits freeform)
- Claude pre-fills headline and CTA suggestion based on selected USP + brand voice
- All fields editable before proceeding

**Testimonial angle:**
- Shows 3–5 recent high-rated reviews pulled from `/api/reviews` (4–5 stars, sorted by recency)
- User picks one — quote, reviewer name, and stars are auto-populated
- Headline generated by Claude wrapping the testimonial in brand voice
- All fields editable

**Lifestyle angle:**
- Claude drafts headline + primary text from brand voice + context bundle
- User reviews and edits
- CTA editable (default from brand context)

**Offer angle:**
- Free-form fields: headline, body copy, CTA
- Claude suggests copy based on brand voice; user edits freely

In all cases: CTA defaults to the brand's standard CTA from context, editable.

### Step 3: Generate

Single "Generate" button. Fires Gemini with the selected style's `generationPrompt`, tokens resolved from Step 2 inputs. Shows the generated image. Controls:
- **Regenerate** — re-runs with same inputs, new generation
- **Back** — return to Step 2 to adjust content

If `promptOverrides.numberOfVariations > 1`, generates that many images and shows them in a row for comparison.

**API route:** `POST /api/studio/generate`
- Accepts: `{ styleId, tokens: Record<string, string> }`
- Resolves tokens into the stored `generationPrompt`, calls Gemini
- Returns: `{ images: string[] }` (base64 array)

### Step 4: Download / Publish

For each generated image:
- **Download** — saves the image file locally (browser download)
- **Publish to Meta** — opens campaign/adset picker, pushes via existing publish infrastructure (same as PDP builder's publish step)

---

## Copy Generation

**New route:** `POST /api/studio/generate-copy`

Request:
```typescript
{
  brand: string;
  angle: "usp" | "testimonial" | "lifestyle" | "offer";
  nanoBanana: string;       // from the selected style
  selectedContent?: string; // USP text or testimonial quote
}
```

Response:
```typescript
{
  headline: string;      // ≤125 chars
  primaryText: string;   // 2–3 sentences
  ctaText: string;       // ≤20 chars
}
```

Claude uses the brand context bundle + nano-banana angle to generate copy. For testimonial angle, `selectedContent` is the raw quote — Claude wraps it in a headline and leaves the quote as `primaryText`.

---

## Reference Ad Markdown Format (brand-level)

Same format as existing reference ads, with these field conventions for brand-level templates:

```yaml
---
id: winespies_studio_dark_usp_1
label: Dark Overlay — USP Statement
brand: winespies
platform: meta
format: static_image
type: usp                          # usp | testimonial | lifestyle | offer
aspectRatio: "1:1"
objective: brand_awareness
angle: direct_access_usp
nanoBanana: "Direct-from-winery access to bottles most people never find"
imageFile: creative-assets_<uuid>_compressed.webp
promptTemplateId: nano-banana-studio
promptOverrides:
  numberOfVariations: 2
  ctaStyle: discovery
notes: >
  Dark moody layout with centered headline overlay. USP-focused.
  Designed for brand awareness cold traffic.
---

## Ad Description
[Claude-generated visual description of the layout]

## Generation Prompt
[Wine Spies brand modifier prepended]
[Full Gemini prompt with {{headline}}, {{primaryText}}, {{ctaText}} etc.]
```

---

## Files to Create or Modify

| File | Change |
|------|--------|
| `lib/ad-builder.ts` | Modify — add `"usp"` to `AdType` union and add its config entry to `AD_TYPE_CONFIG` |
| `app/api/ad-reference/generate-full/route.ts` | New — Claude Vision → full structured JSON (label, angle, nanoBanana, generationPrompt, etc.) |
| `app/api/ad-reference/batch-ingest/route.ts` | New — scans static folder, ingests unregistered images |
| `app/api/studio/generate-copy/route.ts` | New — brand-level Claude copy generation |
| `app/api/studio/generate/route.ts` | New — Gemini image generation with token resolution |
| `app/creative/ad-builder/studio/page.tsx` | Modify — replace stub with 4-step wizard |
| `app/creative/ad-builder/studio/components/StylePicker.tsx` | New — style grid with angle badges + Add Template card |
| `app/creative/ad-builder/studio/components/ContentConfigurator.tsx` | New — angle-adaptive Step 2 |
| `app/creative/ad-builder/studio/components/GeneratePanel.tsx` | New — generate + regenerate UI |
| `app/creative/ad-builder/studio/components/DownloadPublishPanel.tsx` | New — download + Meta publish |
| `app/creative/ad-builder/studio/hooks/useStudioStyles.ts` | New — fetches reference ads filtered to brand-level types |
| `lib/ad-prompt-templates.ts` | Modify — add `buildStudioGeneratePrompt()` for brand-level copy generation |

---

## Edge Cases

- **No registered templates yet:** StylePicker shows only the "Add Template" card and a prompt to run batch ingest.
- **Batch ingest Claude failure on one image:** that image is skipped and listed in `errors[]`; others continue.
- **Testimonial angle, no reviews available:** falls back to freeform copy fields with a Claude draft.
- **Token missing at generate time:** unresolved `{{tokens}}` are replaced with empty string before sending to Gemini (Gemini prompt instructs it to close the gap when a token is blank).
- **Brand modifier unavailable (context bundle empty):** `generate-full` proceeds without prepending a modifier; the stored prompt will lack it. User should complete context hub before ingesting.
