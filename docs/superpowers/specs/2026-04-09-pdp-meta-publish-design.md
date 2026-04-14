# PDP Ad Builder — Meta Publish Fix + Create Ad Set

**Date:** 2026-04-09
**Status:** Approved

## Overview

Three targeted changes to the PDP Ad Builder (`/creative/pdp`):

1. **Review Brief stub fix** — templates without a `TEMPLATE_SCHEMAS` entry are silently dropped from step 3; fix by generating a stub result so all selected templates appear
2. **Publish error visibility** — errors from Meta are only shown as hover tooltips; show them inline and add a preflight config check
3. **Create new ad set** — full Meta ad set creation form within the Publish step (all configurable options; no hardcoded defaults)

---

## Change 1: Review Brief Stub Fix

### Problem

`resolveBatchMappings` in `wineAdContext.ts` filters `TEMPLATE_SCHEMAS` by the selected template IDs. Only `winespies_pdp_cult_1` has a schema entry. Any other template (e.g. "Blackdots - badges") is silently skipped — so selecting 2 templates shows 1 in Review Brief, counts say "1 ad" instead of "2 ads". Step 4 (generate) uses the styles array directly and is unaffected, so 2 ads correctly generate.

### Fix

Change `resolveBatchMappings` to accept `styles: { id: string; name: string }[]` instead of `templateIds: string[]`. For each style:
- If a matching `TEMPLATE_SCHEMAS` entry exists → existing field-mapping behavior (unchanged)
- If no schema exists → generate a stub `TemplateMappingResult` with `can_generate: true`, `blocking_fields: []`, `fields: []`

DataReview already renders rows with empty `fields` arrays gracefully (just the template name + ready status).

### Files

- `app/creative/ad-builder/_shared/wineAdContext.ts` — update `resolveBatchMappings` signature and add stub branch
- `app/creative/pdp/hooks/useBatchMapping.ts` — update hook to accept `{ id: string; name: string }[]`
- `app/creative/pdp/page.tsx` — pass `styles.filter(s => selectedStyleIds.includes(s.id))` instead of `selectedStyleIds`

---

## Change 2: Publish Error Visibility

### Problem

`PublishPanel` shows "Failed" text with `title={state.error}` — the actual Meta error is only visible on hover. When publish fails, there's no way to diagnose the problem from the UI. Common failure causes: `META_PAGE_ID` env var missing, access token expired/insufficient permissions, Meta API rejection.

### Fix

**Inline error display:** When a job's status is `"error"`, show `state.error` text below the ad card in a styled danger callout. Add a "Retry" button per failed job.

**Preflight check:** On PublishPanel mount (alongside the adsets fetch), call `GET /api/pdp/publish?action=preflight` which validates:
- `META_ACCESS_TOKEN` is set
- `META_PAGE_ID` is set (or brand has `metaPageId`)

No live Meta API call during preflight — env var presence is sufficient; any token issues will surface immediately on the first publish attempt with a clear inline error.

If preflight fails, show a banner at the top of the panel explaining which config is missing before the user tries to publish.

**Improved error surfacing in route:** The publish route already catches per-job errors and returns them in `results[].error`. No route changes needed — just surface them in the UI.

### Files

- `app/creative/pdp/components/PublishPanel.tsx` — inline error display, retry button, preflight banner
- `app/api/pdp/publish/route.ts` — add `GET ?action=preflight` handler

---

## Change 3: Create New Ad Set

### Problem

The Publish step only allows selecting an existing ad set. Users need to be able to create a new ad set with full control over all Meta ad set settings, without leaving the flow.

### UI Design

The "Destination Ad Set" section gets a toggle: **Use existing** | **Create new**.

**Use existing** — current dropdown behavior, unchanged.

**Create new** — a full ad set configuration form with these sections:

#### Identity
| Field | Type | Notes |
|-------|------|-------|
| Ad set name | Text input | Required |
| Campaign | Dropdown | Fetched from Meta — active/paused only |

#### Budget
| Field | Type | Notes |
|-------|------|-------|
| Budget type | Radio: Daily / Lifetime | |
| Amount | Number input (dollars) | Required |
| Start date | Date picker | Defaults to today |
| End date | Date picker | Shown only for Lifetime budget; required |

#### Optimization & Bidding
| Field | Type | Notes |
|-------|------|-------|
| Optimization goal | Dropdown | Conversions, Link Clicks, Reach, Impressions, Landing Page Views, Value |
| Bid strategy | Dropdown | Lowest Cost (auto), Cost Cap, Bid Cap |
| Bid amount | Number input (dollars) | Shown only when Cost Cap or Bid Cap selected |

Billing event is auto-derived from optimization goal (always `IMPRESSIONS`) and not shown to the user — this is valid for all supported optimization goals.

#### Targeting
| Field | Type | Notes |
|-------|------|-------|
| Custom audiences | Multi-select | Fetched from Meta; includes both custom and lookalike audiences |
| Countries | Multi-select or text tags | Defaults to `["US"]` but user can change |
| Age range | Dual slider or two number inputs | Min 18–65, Max 18–65+ (65+ = no upper limit) |
| Gender | Segmented: All / Men / Women | |

#### Placements
| Field | Type | Notes |
|-------|------|-------|
| Placement mode | Radio: Automatic / Manual | Automatic = Meta decides |
| Facebook positions | Checkboxes (if Manual) | Feed, Story, Reels |
| Instagram positions | Checkboxes (if Manual) | Feed (stream), Story, Reels |
| Audience Network | Checkbox (if Manual) | |

#### Status
New ad sets always created as **Paused** — no UI control needed; user activates in Meta Ads Manager.

---

### Data Fetched from Meta on Panel Mount (parallel)

| Action | Endpoint | Used for |
|--------|----------|----------|
| `?action=adsets` | `/{accountId}/adsets` | Existing ad set dropdown |
| `?action=campaigns` | `/{accountId}/campaigns` | Campaign dropdown in new-adset form |
| `?action=audiences` | `/{accountId}/customaudiences` | Audience multi-select |
| `?action=preflight` | Local env check | Config validation banner |

---

### Flow When Creating New

1. User fills out the form, clicks "Create Ad Set & Publish"
2. POST `/api/pdp/publish` with `adSetId: null` and `newAdSet: { ...all form fields }`
3. Route calls `createAdSet()` → gets back the new `adSetId`
4. Route proceeds with normal per-job publish flow using the new `adSetId`
5. UI shows created ad set name + success state per ad

---

### New lib functions (`lib/meta-publish.ts`)

```typescript
type MetaCampaignLive = {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  objective: string;
  budget_rebalance_flag?: boolean; // true = CBO campaign
};

type MetaAudience = {
  id: string;
  name: string;
  subtype: string; // "CUSTOM", "LOOKALIKE", etc.
};

type NewAdSetInput = {
  campaignId: string;
  name: string;
  budgetType: "daily" | "lifetime";
  budgetCents: number;             // dollars × 100
  startTime: string;               // ISO 8601
  endTime?: string;                // required for lifetime budget
  optimizationGoal: string;        // e.g. "OFFSITE_CONVERSIONS"
  bidStrategy: "LOWEST_COST_WITHOUT_CAP" | "COST_CAP" | "BID_CAP";
  bidAmountCents?: number;         // required for COST_CAP / BID_CAP
  targeting: {
    geoCountries: string[];        // e.g. ["US"]
    ageMin: number;                // 18–65
    ageMax: number;                // 18–65; 65 = no upper cap (omit from API)
    genders?: number[];            // 1=male, 2=female; omit for all
    customAudiences?: { id: string; name: string }[];
  };
  placementMode: "automatic" | "manual";
  publisherPlatforms?: string[];   // ["facebook", "instagram"] etc.
  facebookPositions?: string[];    // ["feed", "story", "reels"]
  instagramPositions?: string[];   // ["stream", "story", "reels"]
};

fetchCampaignsLive(brandId: string): Promise<MetaCampaignLive[]>
// GET /{accountId}/campaigns?fields=id,name,status,effective_status,objective,budget_rebalance_flag&limit=100
// Filters to effective_status IN [ACTIVE, PAUSED]

fetchAudiencesLive(brandId: string): Promise<MetaAudience[]>
// GET /{accountId}/customaudiences?fields=id,name,subtype&limit=200

createAdSet(brandId: string, input: NewAdSetInput): Promise<{ id: string }>
// POST /{accountId}/adsets
// Builds targeting spec and placement spec from input
// Always sets status: "PAUSED", billing_event: "IMPRESSIONS"
```

---

### Updated API (`app/api/pdp/publish/route.ts`)

```
GET ?action=adsets     → { adSets: MetaAdSetLive[] }       (existing, unchanged)
GET ?action=campaigns  → { campaigns: MetaCampaignLive[] } (new)
GET ?action=audiences  → { audiences: MetaAudience[] }     (new)
GET ?action=preflight  → { ok: boolean; missing: string[] } (new)

POST body:
{
  brand: string;
  adSetId: string | null;   // null when creating new
  newAdSet?: NewAdSetInput;  // required when adSetId is null
  jobs: PublishJob[];
}
```

---

### Files

- `lib/meta-publish.ts` — add types + `fetchCampaignsLive`, `fetchAudiencesLive`, `createAdSet`
- `app/api/pdp/publish/route.ts` — add `?action=campaigns`, `?action=audiences`, `?action=preflight`; handle `newAdSet` in POST
- `app/creative/pdp/components/PublishPanel.tsx` — full new-adset form, toggle, preflight banner, inline errors

---

## Data Flow Summary

```
Step 2 (StyleSelector)
  styles[] selected → page passes { id, name }[] to useBatchMapping

Step 3 (DataReview via useBatchMapping)
  resolveBatchMappings({ id, name }[]) → stub results for no-schema templates
  All selected templates appear in Review Brief with correct counts

Step 5 (PublishPanel)
  Mount: parallel fetch → adsets + campaigns + audiences + preflight
  Preflight fails → banner shows missing config, publish blocked

  Mode A (existing): select ad set from dropdown → Publish
  Mode B (new): fill form → "Create Ad Set & Publish"
    → POST with newAdSet config
    → route creates ad set → publishes jobs into it
    → UI shows new ad set name in success state

  Per-job error: full error message shown inline with Retry button
```

---

## Out of Scope

- Campaign creation (only ad set creation)
- Excluded audiences (inclusion audiences only)
- Interest-based targeting (custom/lookalike audiences cover Wine Spies use case)
- Bulk retry (per-job retry only)
- Any changes to step 4 (Generate)
