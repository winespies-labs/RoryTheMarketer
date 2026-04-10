# Ads Manager Settings + PDP Bulk Publish — Design Spec

**Date:** 2026-04-09
**Status:** Approved

## Overview

Two tightly related sub-projects:

1. **Settings page improvements** — Add UTM tracking defaults and Creative Enhancement defaults to `/ads-manager/settings`. Saved server-side so any publish route can read them without client involvement.
2. **PDP Publish flow improvements** — AI copy generation per wine and adset mode toggle (shared vs. per-wine) in the PDP builder's Publish step (step 5).

Settings are a prerequisite for the publish improvements — the publish route reads from `ad-settings.json` automatically.

---

## Sub-project 1: Settings Page

### Storage

New JSON file: `data/{brandId}/ad-settings.json`

Schema:
```typescript
interface AdSettings {
  utm: {
    source: string;       // e.g. "facebook"
    medium: string;       // e.g. "paid"
    campaign: string;     // e.g. "{{campaign.name}}"
    content: string;      // e.g. "{{ad.name}}"
    rawOverride: string;  // e.g. "utm_source=facebook&utm_medium=paid&..." — overrides individual fields when set
  };
  creativeEnhancements: {
    images: Record<string, boolean>;   // keyed by enhancement slug
    videos: Record<string, boolean>;   // keyed by enhancement slug
    carousel: Record<string, boolean>; // keyed by enhancement slug
  };
}
```

Default values (all enhancements off, UTM fields empty) are returned when the file doesn't exist yet.

### API Route

`GET /api/ads/settings?brand=winespies` — returns current `AdSettings`
`POST /api/ads/settings?brand=winespies` — saves body as `AdSettings`, returns `{ ok: true }`

### Settings Page UI

New sections added to `app/ads-manager/settings/page.tsx` below existing content:

#### UTM Tracking

Four labeled text inputs in a 2×2 grid:
- Source (`utm.source`)
- Medium (`utm.medium`)
- Campaign (`utm.campaign`)
- Content (`utm.content`)

Below: a full-width textarea labeled "Raw override (overrides fields above when set)" for `utm.rawOverride`.

Save button at section level (or shared with enhancements — one "Save Settings" button for the whole page).

#### Creative Enhancements

Three-column toggle table. Each column is a `<section>` with a heading (Images / Videos / Carousel) and a list of toggle rows. Each row: label on left, toggle switch on right.

**Images column:**
| Slug | Label |
|------|-------|
| `show_relevant_comments` | Show relevant comments |
| `visual_touchups` | Visual touchups |
| `text_improvements` | Text improvements |
| `add_text_overlays` | Add text overlays |
| `brightness_contrast` | Brightness & contrast |
| `music` | Music |
| `animation` | Animation |
| `add_site_links` | Add site links |
| `add_catalog_items` | Add catalog items |
| `add_details` | Add details |
| `enhance_cta` | Enhance CTA |
| `reveal_details` | Reveal details |
| `flex_media` | Flex media |
| `translate_text` | Translate text |
| `show_summaries` | Show summaries |
| `show_spotlights` | Show spotlights |

**Videos column:**
| Slug | Label |
|------|-------|
| `show_relevant_comments` | Show relevant comments |
| `visual_touchups` | Visual touchups |
| `text_improvements` | Text improvements |
| `add_video_effects` | Add video effects |
| `add_catalog_items` | Add catalog items |
| `add_site_links` | Add site links |
| `add_details` | Add details |
| `enhance_cta` | Enhance CTA |
| `reveal_details` | Reveal details |
| `flex_media` | Flex media |
| `translate_text` | Translate text |
| `show_summaries` | Show summaries |
| `show_spotlights` | Show spotlights |

**Carousel column:**
| Slug | Label |
|------|-------|
| `show_relevant_comments` | Show relevant comments |
| `visual_touchups` | Visual touchups |
| `profile_end_card` | Profile end card |
| `highlight_card` | Highlight card |
| `dynamic_description` | Dynamic description |
| `adapt_multi_image` | Adapt multi-image |
| `enhance_cta` | Enhance CTA |

### How Publish Reads Settings

The publish route (`app/api/pdp/publish/route.ts`) reads `ad-settings.json` at publish time via a new `getAdSettings(brandId)` helper in `lib/ad-settings.ts`. It applies:
- UTM: if `rawOverride` is set, append it to the destination URL; otherwise build `?utm_source=...&utm_medium=...&utm_campaign=...&utm_content=...` and append to the URL
- Creative enhancements: passed as `degrees_of_freedom_spec` in the Meta API `createAdCreative()` call (only enabled enhancements are included)

---

## Sub-project 2: PDP Publish Flow Improvements

### AI Copy Generation

New API route: `POST /api/pdp/generate-copy`

Request:
```typescript
{
  brand?: string;
  wines: Array<{
    saleId: number;
    wineName: string;
    score?: string;
    pullQuote?: string;
    salePrice: string;
    retailPrice: string;
  }>;
}
```

Response:
```typescript
{
  copies: Array<{
    saleId: number;
    headline: string;      // ≤125 chars
    primaryText: string;   // 2-3 sentences
    description: string;   // ≤30 chars
  }>;
}
```

Implementation: fires one Claude call per wine in parallel (`Promise.all`). System prompt injects brand context bundle. User prompt includes wine data. Claude returns structured JSON with `headline`, `primaryText`, `description`. Max duration: 60s.

### PublishPanel UI Changes

**"Generate Copy" button** — appears at the top of the publish step, above the job list. Clicking fires `POST /api/pdp/generate-copy` with all wines in the current batch. While loading, shows a spinner and disables the button. On completion, pre-fills each job's headline/primaryText/description fields. Each wine also gets an individual "↺ Regenerate" icon next to its copy fields to re-run Claude for just that wine.

**Adset mode toggle** — a segmented control at the top of the panel:
- `All wines → one adset` (default, current behavior) — shows the existing campaign+adset picker
- `One adset per wine` — shows the campaign picker plus a single "Adset defaults" form (daily budget, bid strategy, bid amount) that applies to all auto-created adsets. Adsets are named after each wine (e.g. "2022 Marchesi Antinori Solaia"). Targeting is inherited from the campaign's existing adset targeting defaults.

**Publish behavior changes:**
- UTM and creative enhancements are no longer configured in this step — they are read from `ad-settings.json` automatically
- In "one adset per wine" mode: `createAdSet()` is called per wine during publish, named after the wine, under the selected campaign, before creating the creative and ad

### Copy fields per wine

The existing copy editing UI in PublishPanel (headline, primary_text, description) remains. AI generation pre-fills these fields. They stay fully editable before publish.

---

## Files to Create or Modify

| File | Change |
|------|--------|
| `lib/ad-settings.ts` | New — `getAdSettings(brandId)`, `saveAdSettings(brandId, settings)`, default values, TypeScript types |
| `app/api/ads/settings/route.ts` | New — GET + POST handler |
| `app/ads-manager/settings/page.tsx` | Modify — add UTM section + Creative Enhancements section |
| `app/api/pdp/generate-copy/route.ts` | New — parallel Claude copy generation per wine |
| `app/creative/pdp/components/PublishPanel.tsx` | Modify — add Generate Copy button, adset mode toggle, per-wine regenerate |
| `app/api/pdp/publish/route.ts` | Modify — read ad-settings.json, apply UTM + enhancements to creative params |

---

## Edge Cases

- **No ad-settings.json yet:** `getAdSettings()` returns safe defaults (all enhancements off, UTM fields empty). Publish works normally — no UTM appended, no enhancements sent.
- **UTM rawOverride set:** raw string is appended as-is to the destination URL; individual fields are ignored.
- **Copy generation fails for one wine:** that wine's fields stay empty/as-was; other wines are unaffected. A per-wine error state is shown.
- **One adset per wine, adset creation fails:** that wine's publish fails; others continue. Error shown per wine in publish results.
- **Creative enhancements — Meta API format:** `degrees_of_freedom_spec` takes a nested object. Only enhancements with `value: true` in settings are included. If all are false, the field is omitted entirely from the API call.
