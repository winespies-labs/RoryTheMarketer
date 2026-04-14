# PDP Ad Builder — Meta Publish Fix + Create Ad Set Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix the Review Brief template count bug, surface Meta publish errors properly, and add a full ad set creation form to the Publish step.

**Architecture:** Three independent change groups — (1) fix `resolveBatchMappings` to stub unknown templates, (2) extend `lib/meta-publish.ts` + the publish API route with new Meta operations, (3) rewrite `PublishPanel.tsx` and extract a `NewAdSetForm.tsx` component for the full ad set creation UI.

**Tech Stack:** Next.js 15 App Router, TypeScript strict, Tailwind CSS 4, Anthropic SDK not used here — Meta Graph API via existing `lib/meta-graph.ts` helpers (`graphGet`, `graphPost`).

---

## File Map

| Action | File | Purpose |
|--------|------|---------|
| Modify | `app/creative/ad-builder/_shared/wineAdContext.ts` | Change `resolveBatchMappings` to accept `{ id, name }[]` and generate stubs for templates with no schema |
| Modify | `app/creative/pdp/hooks/useBatchMapping.ts` | Update hook signature to match |
| Modify | `app/creative/pdp/page.tsx` | Pass `selectedStyles` objects instead of `selectedStyleIds` string array |
| Modify | `lib/meta-publish.ts` | Add types + `fetchCampaignsLive`, `fetchAudiencesLive`, `createAdSet` |
| Modify | `app/api/pdp/publish/route.ts` | Add GET actions (preflight/campaigns/audiences), extend POST to handle `newAdSet` |
| Modify | `app/creative/pdp/components/PublishPanel.tsx` | Preflight banner, inline errors, retry, mode toggle, integrate NewAdSetForm |
| Create | `app/creative/pdp/components/NewAdSetForm.tsx` | Self-contained full Meta ad set config form |

---

## Task 1: Review Brief Stub Fix

**Files:**
- Modify: `app/creative/ad-builder/_shared/wineAdContext.ts`
- Modify: `app/creative/pdp/hooks/useBatchMapping.ts`
- Modify: `app/creative/pdp/page.tsx`

- [ ] **Step 1: Update `resolveBatchMappings` in `wineAdContext.ts`**

Open `app/creative/ad-builder/_shared/wineAdContext.ts`. Find the `resolveBatchMappings` function (around line 463). Replace it entirely:

```typescript
/**
 * Resolves N wines × M templates into a BatchMappingResult.
 * Templates with a TEMPLATE_SCHEMAS entry get full field validation.
 * Templates without a schema entry get a stub result (always ready, no fields).
 */
export function resolveBatchMappings(
  contexts: WineAdContext[],
  styles: { id: string; name: string }[]
): BatchMappingResult {
  const knownIds = new Set(TEMPLATE_SCHEMAS.map((s) => s.template_id));
  const schemas = TEMPLATE_SCHEMAS.filter((s) =>
    styles.some((style) => style.id === s.template_id)
  );
  const stubStyles = styles.filter((style) => !knownIds.has(style.id));

  const mappings: Record<string, TemplateMappingResult> = {};
  let ready = 0;
  let blocked = 0;

  for (const context of contexts) {
    for (const schema of schemas) {
      const key = `${context.sale_id}:${schema.template_id}`;
      const result = resolveTemplateFields(context, schema);
      mappings[key] = result;
      if (result.can_generate) ready++;
      else blocked++;
    }
    for (const style of stubStyles) {
      const key = `${context.sale_id}:${style.id}`;
      mappings[key] = {
        template_id: style.id,
        template_name: style.name,
        wine_display_name: context.display_name,
        sale_id: context.sale_id,
        can_generate: true,
        blocking_fields: [],
        fields: [],
      };
      ready++;
    }
  }

  const stubSchemas: TemplateSchema[] = stubStyles.map((s) => ({
    template_id: s.id,
    template_name: s.name,
    fields: [],
  }));

  return {
    wines: contexts,
    schemas: [...schemas, ...stubSchemas],
    mappings,
    total_ads: contexts.length * styles.length,
    ready_to_generate: ready,
    blocked,
  };
}
```

- [ ] **Step 2: Update `useBatchMapping` hook**

Replace the entire contents of `app/creative/pdp/hooks/useBatchMapping.ts`:

```typescript
"use client";

import { useMemo } from "react";
import {
  resolveBatchMappings,
  type BatchMappingResult,
  type WineAdContext,
} from "../../ad-builder/_shared/wineAdContext";

/**
 * Wraps resolveBatchMappings. Re-runs whenever selected wines or styles change.
 * Returns null when either list is empty.
 */
export function useBatchMapping(
  contexts: WineAdContext[],
  styles: { id: string; name: string }[]
): BatchMappingResult | null {
  return useMemo(() => {
    if (contexts.length === 0 || styles.length === 0) return null;
    return resolveBatchMappings(contexts, styles);
  }, [contexts, styles]);
}
```

- [ ] **Step 3: Update `page.tsx` to pass style objects**

Open `app/creative/pdp/page.tsx`. Find this line (around line 93):

```typescript
const batch = useBatchMapping(feed.selectedContexts, selectedStyleIds);
```

Replace with:

```typescript
const selectedStyles = styles.filter((s) => selectedStyleIds.includes(s.id));
const batch = useBatchMapping(feed.selectedContexts, selectedStyles);
```

- [ ] **Step 4: Verify**

Run `npm run dev`. Navigate to `/creative/pdp`. Select one wine, select 2 templates (e.g. "Blackdots - badges" + "Wine Spies PDP Cult 1"), click Next to Review Brief.

Expected: header reads "1 wine × 2 templates = 2 ads" and both template names appear in the brief. Previously it showed 1 ad and only one template.

- [ ] **Step 5: Commit**

```bash
git add app/creative/ad-builder/_shared/wineAdContext.ts \
        app/creative/pdp/hooks/useBatchMapping.ts \
        app/creative/pdp/page.tsx
git commit -m "fix: show all selected templates in Review Brief via stub mapping"
```

---

## Task 2: Meta Lib — New Types and Functions

**Files:**
- Modify: `lib/meta-publish.ts`

- [ ] **Step 1: Add new types and functions to `lib/meta-publish.ts`**

Open `lib/meta-publish.ts`. After the existing `MetaAdSetLive` type (around line 27), add the following block. Do not remove any existing code.

```typescript
export type MetaCampaignLive = {
  id: string;
  name: string;
  status: string;
  effective_status: string;
  objective: string;
  budget_rebalance_flag?: boolean;
};

export type MetaAudience = {
  id: string;
  name: string;
  subtype: string;
};

export type NewAdSetInput = {
  campaignId: string;
  name: string;
  budgetType: "daily" | "lifetime";
  /** Amount in cents (dollars × 100) */
  budgetCents: number;
  /** ISO 8601 string */
  startTime: string;
  /** ISO 8601 string — required for lifetime budget */
  endTime?: string;
  /** e.g. "OFFSITE_CONVERSIONS", "LINK_CLICKS", "REACH" */
  optimizationGoal: string;
  bidStrategy: "LOWEST_COST_WITHOUT_CAP" | "COST_CAP" | "BID_CAP";
  /** In cents — required for COST_CAP / BID_CAP */
  bidAmountCents?: number;
  targeting: {
    geoCountries: string[];
    ageMin: number;
    ageMax: number;
    /** 1 = male, 2 = female — omit for all genders */
    genders?: number[];
    customAudiences?: { id: string; name: string }[];
  };
  placementMode: "automatic" | "manual";
  publisherPlatforms?: string[];
  facebookPositions?: string[];
  instagramPositions?: string[];
};
```

- [ ] **Step 2: Add `fetchCampaignsLive`**

After the new types block, add:

```typescript
export async function fetchCampaignsLive(
  brandId: string,
): Promise<MetaCampaignLive[]> {
  const accountId = getAdAccountId(brandId);
  const fields =
    "id,name,status,effective_status,objective,budget_rebalance_flag";

  const result = await graphGet<{ data: MetaCampaignLive[] }>(
    `${accountId}/campaigns`,
    { fields, limit: 100 },
  );

  return (result.data ?? []).filter(
    (c) =>
      c.effective_status === "ACTIVE" || c.effective_status === "PAUSED",
  );
}
```

- [ ] **Step 3: Add `fetchAudiencesLive`**

```typescript
export async function fetchAudiencesLive(
  brandId: string,
): Promise<MetaAudience[]> {
  const accountId = getAdAccountId(brandId);

  const result = await graphGet<{ data: MetaAudience[] }>(
    `${accountId}/customaudiences`,
    { fields: "id,name,subtype", limit: 200 },
  );

  return result.data ?? [];
}
```

- [ ] **Step 4: Add `createAdSet`**

```typescript
export async function createAdSet(
  brandId: string,
  input: NewAdSetInput,
): Promise<{ id: string }> {
  const accountId = getAdAccountId(brandId);

  // Build targeting spec
  const targetingSpec: Record<string, unknown> = {
    geo_locations: { countries: input.targeting.geoCountries },
    age_min: input.targeting.ageMin,
    ...(input.targeting.ageMax < 65
      ? { age_max: input.targeting.ageMax }
      : {}),
  };
  if (input.targeting.genders?.length) {
    targetingSpec.genders = input.targeting.genders;
  }
  if (input.targeting.customAudiences?.length) {
    targetingSpec.custom_audiences = input.targeting.customAudiences;
  }

  // Merge manual placements into targeting spec (Meta API pattern)
  if (
    input.placementMode === "manual" &&
    input.publisherPlatforms?.length
  ) {
    targetingSpec.publisher_platforms = input.publisherPlatforms;
    if (input.facebookPositions?.length) {
      targetingSpec.facebook_positions = input.facebookPositions;
    }
    if (input.instagramPositions?.length) {
      targetingSpec.instagram_positions = input.instagramPositions;
    }
  }

  const body: Record<string, string | number | boolean | undefined> = {
    name: input.name,
    campaign_id: input.campaignId,
    optimization_goal: input.optimizationGoal,
    billing_event: "IMPRESSIONS",
    bid_strategy: input.bidStrategy,
    targeting: JSON.stringify(targetingSpec),
    status: "PAUSED",
    start_time: input.startTime,
  };

  if (input.endTime) {
    body.end_time = input.endTime;
  }
  if (input.budgetType === "daily") {
    body.daily_budget = String(input.budgetCents);
  } else {
    body.lifetime_budget = String(input.budgetCents);
  }
  if (input.bidAmountCents !== undefined) {
    body.bid_amount = String(input.bidAmountCents);
  }

  const result = await graphPost<{ id: string }>(
    `${accountId}/adsets`,
    body,
  );

  if (!result.id) {
    throw new Error("Failed to create ad set — no ID returned");
  }

  return { id: result.id };
}
```

- [ ] **Step 5: Verify TypeScript compiles**

```bash
npm run build 2>&1 | head -40
```

Expected: no errors in `lib/meta-publish.ts`. (Other errors in this run are unrelated and fine.)

- [ ] **Step 6: Commit**

```bash
git add lib/meta-publish.ts
git commit -m "feat: add fetchCampaignsLive, fetchAudiencesLive, createAdSet to meta-publish"
```

---

## Task 3: Publish Route — New GET Actions

**Files:**
- Modify: `app/api/pdp/publish/route.ts`

- [ ] **Step 1: Add imports for new lib functions**

Open `app/api/pdp/publish/route.ts`. Find the import from `@/lib/meta-publish` (line 4–9). Add the new functions:

```typescript
import {
  uploadAdImage,
  createAdCreative,
  createAd,
  fetchAdSetsLive,
  fetchCampaignsLive,
  fetchAudiencesLive,
  createAdSet,
  type NewAdSetInput,
} from "@/lib/meta-publish";
```

- [ ] **Step 2: Add preflight, campaigns, and audiences GET handlers**

Find the existing GET handler. After the `if (action === "adsets")` block (ends around line 29), add three new blocks before the final `return NextResponse.json({ error: "Unknown action" })`:

```typescript
  if (action === "preflight") {
    const missing: string[] = [];
    if (!process.env.META_ACCESS_TOKEN) missing.push("META_ACCESS_TOKEN");
    const brandObj = getBrand(brand);
    if (!brandObj?.metaPageId && !process.env.META_PAGE_ID)
      missing.push("META_PAGE_ID");
    return NextResponse.json({ ok: missing.length === 0, missing });
  }

  if (action === "campaigns") {
    try {
      const campaigns = await fetchCampaignsLive(brand);
      return NextResponse.json({ campaigns });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to fetch campaigns";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }

  if (action === "audiences") {
    try {
      const audiences = await fetchAudiencesLive(brand);
      return NextResponse.json({ audiences });
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to fetch audiences";
      return NextResponse.json({ error: msg }, { status: 500 });
    }
  }
```

- [ ] **Step 3: Verify**

```bash
npm run dev
```

Then in a new terminal:

```bash
curl "http://localhost:3000/api/pdp/publish?action=preflight&brand=winespies"
```

Expected: `{"ok":true,"missing":[]}` if env vars are set, or `{"ok":false,"missing":["META_ACCESS_TOKEN"]}` etc. if they're missing.

- [ ] **Step 4: Commit**

```bash
git add app/api/pdp/publish/route.ts
git commit -m "feat: add preflight/campaigns/audiences GET actions to publish route"
```

---

## Task 4: Publish Route — Handle `newAdSet` in POST

**Files:**
- Modify: `app/api/pdp/publish/route.ts`

- [ ] **Step 1: Update `PublishRequest` interface**

Find the `PublishRequest` interface in `app/api/pdp/publish/route.ts` (around line 46). Replace it:

```typescript
interface PublishRequest {
  brand: string;
  adSetId: string | null;
  newAdSet?: NewAdSetInput;
  jobs: PublishJob[];
}
```

- [ ] **Step 2: Replace ad set resolution logic in the POST handler**

Find this block in the POST handler (around line 66–71):

```typescript
  if (!adSetId) {
    return NextResponse.json(
      { error: "New ad set creation requires a campaign ID. Please select an existing ad set." },
      { status: 400 }
    );
  }
```

Replace it with:

```typescript
  let resolvedAdSetId = adSetId;

  if (!resolvedAdSetId) {
    if (!newAdSet) {
      return NextResponse.json(
        { error: "Must provide adSetId or newAdSet" },
        { status: 400 },
      );
    }
    try {
      const { id } = await createAdSet(brand, newAdSet);
      resolvedAdSetId = id;
    } catch (err) {
      const msg =
        err instanceof Error ? err.message : "Failed to create ad set";
      return NextResponse.json(
        { error: `Ad set creation failed: ${msg}` },
        { status: 500 },
      );
    }
  }
```

- [ ] **Step 3: Update the `createAd` call to use `resolvedAdSetId`**

Find the `createAd` call in the `results` map (around line 90):

```typescript
        const { id: adId } = await createAd(brand, {
          name: `PDP — ${job.wineName}`,
          adsetId: adSetId,
          creativeId,
          status: "ACTIVE",
        });
```

Change `adsetId: adSetId` to `adsetId: resolvedAdSetId`:

```typescript
        const { id: adId } = await createAd(brand, {
          name: `PDP — ${job.wineName}`,
          adsetId: resolvedAdSetId,
          creativeId,
          status: "ACTIVE",
        });
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npm run build 2>&1 | grep "pdp/publish"
```

Expected: no errors on that file.

- [ ] **Step 5: Commit**

```bash
git add app/api/pdp/publish/route.ts
git commit -m "feat: publish route creates new ad set when adSetId is null"
```

---

## Task 5: PublishPanel — Error Visibility + Preflight

**Files:**
- Modify: `app/creative/pdp/components/PublishPanel.tsx`

- [ ] **Step 1: Add preflight state and fetch**

Open `app/creative/pdp/components/PublishPanel.tsx`. After the existing imports, add a `Preflight` type:

```typescript
interface Preflight {
  ok: boolean;
  missing: string[];
}
```

After the `adSetsError` state line, add:

```typescript
  const [preflight, setPreflight] = useState<Preflight | null>(null);
```

Add a second `useEffect` for the preflight fetch (after the existing `loadAdSets` effect):

```typescript
  useEffect(() => {
    async function checkPreflight() {
      try {
        const res = await fetch(
          "/api/pdp/publish?action=preflight&brand=winespies",
        );
        if (!res.ok) return;
        const data = (await res.json()) as Preflight;
        setPreflight(data);
      } catch {
        // silent — publish attempt will surface the real error
      }
    }
    checkPreflight();
  }, []);
```

- [ ] **Step 2: Add preflight banner to the JSX**

In the JSX return, directly after the outer `<div className="flex flex-col gap-4">` opening tag (before the header row), add:

```tsx
      {preflight && !preflight.ok && (
        <div className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          <p className="font-semibold mb-1">Meta configuration missing</p>
          <p className="text-xs">
            Set the following environment variables to enable publishing:{" "}
            <code className="font-mono bg-danger/10 px-1 rounded">
              {preflight.missing.join(", ")}
            </code>
          </p>
        </div>
      )}
```

- [ ] **Step 3: Add retry function**

Before the `handlePublish` function, add:

```typescript
  async function handleRetry(jobId: string) {
    const job = jobs.find((j) => j.id === jobId);
    if (!job?.imageBase64) return;

    setJobStates((prev) => ({
      ...prev,
      [jobId]: { ...prev[jobId], status: "publishing", error: undefined },
    }));

    try {
      const res = await fetch("/api/pdp/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: "winespies",
          adSetId: selectedAdSetId || null,
          jobs: [
            {
              jobId: job.id,
              imageBase64: job.imageBase64,
              mimeType: job.mimeType,
              wineName: job.wineName,
              ...jobStates[jobId].copy,
              saleUrl: `https://winespies.com/sales/${job.saleId}`,
            },
          ],
        }),
      });
      const data = (await res.json()) as {
        results: Array<{
          jobId: string;
          success: boolean;
          adId?: string;
          error?: string;
        }>;
        error?: string;
      };
      const r = data.results?.[0];
      if (r) {
        setJobStates((prev) => ({
          ...prev,
          [jobId]: {
            ...prev[jobId],
            status: r.success ? "done" : "error",
            metaAdId: r.adId,
            error: r.error,
          },
        }));
      } else if (data.error) {
        setJobStates((prev) => ({
          ...prev,
          [jobId]: { ...prev[jobId], status: "error", error: data.error },
        }));
      }
    } catch (err) {
      setJobStates((prev) => ({
        ...prev,
        [jobId]: {
          ...prev[jobId],
          status: "error",
          error: err instanceof Error ? err.message : "Retry failed",
        },
      }));
    }
  }
```

- [ ] **Step 4: Replace the error display in each job card**

Find this block in the job card render (around line 244):

```tsx
                <div className="shrink-0 flex items-start pt-1">
                  {state.status === "idle" && <span className="text-xs text-muted">Ready</span>}
                  {state.status === "publishing" && <span className="text-xs text-accent animate-pulse">Publishing…</span>}
                  {state.status === "done" && <span className="text-xs text-success font-medium">✅ Published</span>}
                  {state.status === "error" && <span className="text-xs text-danger" title={state.error}>Failed</span>}
                </div>
```

Replace with:

```tsx
                <div className="shrink-0 flex items-start pt-1">
                  {state.status === "idle" && (
                    <span className="text-xs text-muted">Ready</span>
                  )}
                  {state.status === "publishing" && (
                    <span className="text-xs text-accent animate-pulse">
                      Publishing…
                    </span>
                  )}
                  {state.status === "done" && (
                    <span className="text-xs text-success font-medium">
                      ✅ Published
                    </span>
                  )}
                  {state.status === "error" && (
                    <button
                      onClick={() => handleRetry(job.id)}
                      className="text-xs text-accent underline hover:no-underline"
                    >
                      Retry
                    </button>
                  )}
                </div>
```

Then, inside the job card `<div key={job.id} className="border border-border rounded-xl overflow-hidden">`, after the closing `</div>` of the main flex row (after the status column), add an error callout:

```tsx
              {state.status === "error" && state.error && (
                <div className="px-4 pb-3">
                  <p className="text-xs text-danger bg-danger/5 border border-danger/20 rounded-lg px-3 py-2">
                    {state.error}
                  </p>
                </div>
              )}
```

- [ ] **Step 5: Disable publish button when preflight fails**

Find the publish button (around line 258):

```tsx
          disabled={publishing || anyPublishing || !selectedAdSetId}
```

Change to:

```tsx
          disabled={publishing || anyPublishing || !selectedAdSetId || preflight?.ok === false}
```

- [ ] **Step 6: Verify**

Run `npm run dev`. Navigate to step 5. If env vars are missing, confirm the red banner appears. If env vars are set but publish fails, confirm the full error message appears inline below the ad card (not just as a hover tooltip), and a Retry button appears.

- [ ] **Step 7: Commit**

```bash
git add app/creative/pdp/components/PublishPanel.tsx
git commit -m "feat: inline publish errors, retry button, preflight config banner"
```

---

## Task 6: New Ad Set Form Component

**Files:**
- Create: `app/creative/pdp/components/NewAdSetForm.tsx`

- [ ] **Step 1: Create the form component**

Create `app/creative/pdp/components/NewAdSetForm.tsx` with this complete content:

```tsx
"use client";

import type { MetaCampaignLive, MetaAudience } from "@/lib/meta-publish";

export interface NewAdSetFormState {
  campaignId: string;
  name: string;
  budgetType: "daily" | "lifetime";
  budgetAmount: string;
  startDate: string;
  endDate: string;
  optimizationGoal: string;
  bidStrategy: "LOWEST_COST_WITHOUT_CAP" | "COST_CAP" | "BID_CAP";
  bidAmount: string;
  geoCountries: string[];
  ageMin: string;
  ageMax: string;
  gender: "all" | "male" | "female";
  selectedAudiences: MetaAudience[];
  placementMode: "automatic" | "manual";
  publisherPlatforms: string[];
  facebookPositions: string[];
  instagramPositions: string[];
}

export const DEFAULT_NEW_AD_SET: NewAdSetFormState = {
  campaignId: "",
  name: "",
  budgetType: "daily",
  budgetAmount: "",
  startDate: new Date().toISOString().split("T")[0],
  endDate: "",
  optimizationGoal: "OFFSITE_CONVERSIONS",
  bidStrategy: "LOWEST_COST_WITHOUT_CAP",
  bidAmount: "",
  geoCountries: ["US"],
  ageMin: "18",
  ageMax: "65",
  gender: "all",
  selectedAudiences: [],
  placementMode: "automatic",
  publisherPlatforms: [],
  facebookPositions: [],
  instagramPositions: [],
};

const OPTIMIZATION_GOALS = [
  { value: "OFFSITE_CONVERSIONS", label: "Conversions" },
  { value: "LINK_CLICKS", label: "Link Clicks" },
  { value: "REACH", label: "Reach" },
  { value: "IMPRESSIONS", label: "Impressions" },
  { value: "LANDING_PAGE_VIEWS", label: "Landing Page Views" },
  { value: "VALUE", label: "Value (purchase value optimization)" },
];

const FACEBOOK_POSITIONS = [
  { value: "feed", label: "Feed" },
  { value: "story", label: "Stories" },
  { value: "reels", label: "Reels" },
  { value: "right_hand_column", label: "Right Column" },
];

const INSTAGRAM_POSITIONS = [
  { value: "stream", label: "Feed" },
  { value: "story", label: "Stories" },
  { value: "reels", label: "Reels" },
  { value: "explore", label: "Explore" },
];

interface Props {
  campaigns: MetaCampaignLive[];
  audiences: MetaAudience[];
  value: NewAdSetFormState;
  onChange: (updates: Partial<NewAdSetFormState>) => void;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-2">
      {children}
    </p>
  );
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  "px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-accent w-full";
const selectCls =
  "px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-accent w-full";

export default function NewAdSetForm({
  campaigns,
  audiences,
  value,
  onChange,
}: Props) {
  function togglePlatform(platform: string) {
    const current = value.publisherPlatforms;
    onChange({
      publisherPlatforms: current.includes(platform)
        ? current.filter((p) => p !== platform)
        : [...current, platform],
    });
  }

  function togglePosition(
    field: "facebookPositions" | "instagramPositions",
    pos: string,
  ) {
    const current = value[field];
    onChange({
      [field]: current.includes(pos)
        ? current.filter((p) => p !== pos)
        : [...current, pos],
    });
  }

  function toggleAudience(audience: MetaAudience) {
    const already = value.selectedAudiences.some((a) => a.id === audience.id);
    onChange({
      selectedAudiences: already
        ? value.selectedAudiences.filter((a) => a.id !== audience.id)
        : [...value.selectedAudiences, audience],
    });
  }

  function addCountry(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter" && e.key !== ",") return;
    e.preventDefault();
    const code = (e.currentTarget.value ?? "").trim().toUpperCase();
    if (code.length === 2 && !value.geoCountries.includes(code)) {
      onChange({ geoCountries: [...value.geoCountries, code] });
      e.currentTarget.value = "";
    }
  }

  function removeCountry(code: string) {
    onChange({ geoCountries: value.geoCountries.filter((c) => c !== code) });
  }

  const needsBidAmount =
    value.bidStrategy === "COST_CAP" || value.bidStrategy === "BID_CAP";

  return (
    <div className="flex flex-col gap-5">
      {/* Identity */}
      <div>
        <SectionLabel>Identity</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <FieldRow label="Ad set name">
            <input
              type="text"
              placeholder="e.g. Retargeting — Wine Lovers"
              value={value.name}
              onChange={(e) => onChange({ name: e.target.value })}
              className={inputCls}
            />
          </FieldRow>
          <FieldRow label="Campaign">
            <select
              value={value.campaignId}
              onChange={(e) => onChange({ campaignId: e.target.value })}
              className={selectCls}
            >
              <option value="">Select campaign…</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.effective_status})
                </option>
              ))}
            </select>
          </FieldRow>
        </div>
      </div>

      {/* Budget */}
      <div>
        <SectionLabel>Budget</SectionLabel>
        <div className="flex gap-2 mb-3">
          {(["daily", "lifetime"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onChange({ budgetType: t })}
              className={`px-4 py-1.5 text-sm rounded-lg border transition-colors ${
                value.budgetType === t
                  ? "border-accent bg-accent/10 text-accent font-medium"
                  : "border-border text-muted hover:text-foreground"
              }`}
            >
              {t === "daily" ? "Daily" : "Lifetime"}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <FieldRow label="Amount ($)">
            <input
              type="number"
              min="1"
              step="0.01"
              placeholder="0.00"
              value={value.budgetAmount}
              onChange={(e) => onChange({ budgetAmount: e.target.value })}
              className={inputCls}
            />
          </FieldRow>
          <FieldRow label="Start date">
            <input
              type="date"
              value={value.startDate}
              onChange={(e) => onChange({ startDate: e.target.value })}
              className={inputCls}
            />
          </FieldRow>
          {value.budgetType === "lifetime" && (
            <FieldRow label="End date">
              <input
                type="date"
                value={value.endDate}
                min={value.startDate}
                onChange={(e) => onChange({ endDate: e.target.value })}
                className={inputCls}
              />
            </FieldRow>
          )}
        </div>
      </div>

      {/* Optimization & Bidding */}
      <div>
        <SectionLabel>Optimization &amp; Bidding</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <FieldRow label="Optimization goal">
            <select
              value={value.optimizationGoal}
              onChange={(e) => onChange({ optimizationGoal: e.target.value })}
              className={selectCls}
            >
              {OPTIMIZATION_GOALS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </FieldRow>
          <FieldRow label="Bid strategy">
            <select
              value={value.bidStrategy}
              onChange={(e) =>
                onChange({
                  bidStrategy: e.target.value as NewAdSetFormState["bidStrategy"],
                })
              }
              className={selectCls}
            >
              <option value="LOWEST_COST_WITHOUT_CAP">
                Lowest cost (automatic)
              </option>
              <option value="COST_CAP">Cost cap</option>
              <option value="BID_CAP">Bid cap</option>
            </select>
          </FieldRow>
          {needsBidAmount && (
            <FieldRow label="Bid / cost cap ($)">
              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={value.bidAmount}
                onChange={(e) => onChange({ bidAmount: e.target.value })}
                className={inputCls}
              />
            </FieldRow>
          )}
        </div>
        <p className="text-[11px] text-muted mt-2">
          Billing event: Impressions (applied automatically)
        </p>
      </div>

      {/* Targeting */}
      <div>
        <SectionLabel>Targeting</SectionLabel>
        <div className="flex flex-col gap-4">
          {/* Audiences */}
          <FieldRow label="Custom & lookalike audiences">
            <div className="border border-border rounded-lg max-h-36 overflow-y-auto">
              {audiences.length === 0 ? (
                <p className="text-xs text-muted px-3 py-2">
                  No audiences found
                </p>
              ) : (
                audiences.map((a) => {
                  const checked = value.selectedAudiences.some(
                    (s) => s.id === a.id,
                  );
                  return (
                    <label
                      key={a.id}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-surface cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAudience(a)}
                        className="accent-accent"
                      />
                      <span className="flex-1 truncate">{a.name}</span>
                      <span className="text-[10px] text-muted shrink-0">
                        {a.subtype}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </FieldRow>

          {/* Geo */}
          <FieldRow label="Countries (type 2-letter code + Enter)">
            <div className="flex flex-wrap gap-1.5 border border-border rounded-lg px-3 py-2 min-h-[40px]">
              {value.geoCountries.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent/10 text-accent text-xs rounded-full"
                >
                  {c}
                  <button
                    type="button"
                    onClick={() => removeCountry(c)}
                    className="hover:text-danger"
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                type="text"
                maxLength={2}
                placeholder="US"
                onKeyDown={addCountry}
                className="text-sm bg-transparent outline-none w-10 min-w-0"
              />
            </div>
          </FieldRow>

          {/* Age + Gender */}
          <div className="grid grid-cols-3 gap-3">
            <FieldRow label="Min age">
              <input
                type="number"
                min="18"
                max="65"
                value={value.ageMin}
                onChange={(e) => onChange({ ageMin: e.target.value })}
                className={inputCls}
              />
            </FieldRow>
            <FieldRow label="Max age (65 = no limit)">
              <input
                type="number"
                min="18"
                max="65"
                value={value.ageMax}
                onChange={(e) => onChange({ ageMax: e.target.value })}
                className={inputCls}
              />
            </FieldRow>
            <FieldRow label="Gender">
              <select
                value={value.gender}
                onChange={(e) =>
                  onChange({
                    gender: e.target.value as NewAdSetFormState["gender"],
                  })
                }
                className={selectCls}
              >
                <option value="all">All</option>
                <option value="male">Men</option>
                <option value="female">Women</option>
              </select>
            </FieldRow>
          </div>
        </div>
      </div>

      {/* Placements */}
      <div>
        <SectionLabel>Placements</SectionLabel>
        <div className="flex gap-2 mb-3">
          {(["automatic", "manual"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onChange({ placementMode: m })}
              className={`px-4 py-1.5 text-sm rounded-lg border transition-colors ${
                value.placementMode === m
                  ? "border-accent bg-accent/10 text-accent font-medium"
                  : "border-border text-muted hover:text-foreground"
              }`}
            >
              {m === "automatic" ? "Automatic" : "Manual"}
            </button>
          ))}
        </div>

        {value.placementMode === "manual" && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted mb-2">Facebook</p>
              <label className="flex items-center gap-2 text-xs text-muted mb-1.5">
                <input
                  type="checkbox"
                  checked={value.publisherPlatforms.includes("facebook")}
                  onChange={() => togglePlatform("facebook")}
                  className="accent-accent"
                />
                Enable Facebook
              </label>
              {value.publisherPlatforms.includes("facebook") &&
                FACEBOOK_POSITIONS.map((p) => (
                  <label
                    key={p.value}
                    className="flex items-center gap-2 text-xs text-foreground pl-5 mb-1"
                  >
                    <input
                      type="checkbox"
                      checked={value.facebookPositions.includes(p.value)}
                      onChange={() =>
                        togglePosition("facebookPositions", p.value)
                      }
                      className="accent-accent"
                    />
                    {p.label}
                  </label>
                ))}
            </div>
            <div>
              <p className="text-xs text-muted mb-2">Instagram</p>
              <label className="flex items-center gap-2 text-xs text-muted mb-1.5">
                <input
                  type="checkbox"
                  checked={value.publisherPlatforms.includes("instagram")}
                  onChange={() => togglePlatform("instagram")}
                  className="accent-accent"
                />
                Enable Instagram
              </label>
              {value.publisherPlatforms.includes("instagram") &&
                INSTAGRAM_POSITIONS.map((p) => (
                  <label
                    key={p.value}
                    className="flex items-center gap-2 text-xs text-foreground pl-5 mb-1"
                  >
                    <input
                      type="checkbox"
                      checked={value.instagramPositions.includes(p.value)}
                      onChange={() =>
                        togglePosition("instagramPositions", p.value)
                      }
                      className="accent-accent"
                    />
                    {p.label}
                  </label>
                ))}
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-muted border-t border-border pt-3">
        Ad set will be created as <strong>Paused</strong>. Activate it in Meta
        Ads Manager after reviewing.
      </p>
    </div>
  );
}
```

- [ ] **Step 2: Verify it compiles**

```bash
npm run build 2>&1 | grep "NewAdSetForm"
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add app/creative/pdp/components/NewAdSetForm.tsx
git commit -m "feat: add NewAdSetForm component with full Meta ad set configuration"
```

---

## Task 7: PublishPanel — Mode Toggle + NewAdSetForm Integration

**Files:**
- Modify: `app/creative/pdp/components/PublishPanel.tsx`

- [ ] **Step 1: Add imports and new state**

At the top of `PublishPanel.tsx`, add imports:

```typescript
import NewAdSetForm, {
  type NewAdSetFormState,
  DEFAULT_NEW_AD_SET,
} from "./NewAdSetForm";
import type { MetaCampaignLive, MetaAudience, NewAdSetInput } from "@/lib/meta-publish";
```

Add state variables after the existing state declarations:

```typescript
  const [destinationMode, setDestinationMode] = useState<"existing" | "new">("existing");
  const [campaigns, setCampaigns] = useState<MetaCampaignLive[]>([]);
  const [audiences, setAudiences] = useState<MetaAudience[]>([]);
  const [newAdSetForm, setNewAdSetForm] = useState<NewAdSetFormState>(DEFAULT_NEW_AD_SET);
```

- [ ] **Step 2: Fetch campaigns and audiences on mount**

Replace the existing `loadAdSets` useEffect with an expanded version that fetches all three in parallel:

```typescript
  useEffect(() => {
    async function loadData() {
      try {
        const [adSetsRes, campaignsRes, audiencesRes] = await Promise.all([
          fetch("/api/pdp/publish?action=adsets&brand=winespies"),
          fetch("/api/pdp/publish?action=campaigns&brand=winespies"),
          fetch("/api/pdp/publish?action=audiences&brand=winespies"),
        ]);

        if (adSetsRes.ok) {
          const data = (await adSetsRes.json()) as { adSets: AdSet[] };
          setAdSets(data.adSets ?? []);
          if (data.adSets?.length > 0) setSelectedAdSetId(data.adSets[0].id);
        } else {
          setAdSetsError(`HTTP ${adSetsRes.status}`);
        }

        if (campaignsRes.ok) {
          const data = (await campaignsRes.json()) as {
            campaigns: MetaCampaignLive[];
          };
          setCampaigns(data.campaigns ?? []);
        }

        if (audiencesRes.ok) {
          const data = (await audiencesRes.json()) as {
            audiences: MetaAudience[];
          };
          setAudiences(data.audiences ?? []);
        }
      } catch (err) {
        setAdSetsError(
          err instanceof Error ? err.message : "Failed to load data",
        );
      } finally {
        setAdSetsLoading(false);
      }
    }
    loadData();
  }, []);
```

- [ ] **Step 3: Add a helper to convert form state to `NewAdSetInput`**

Add this function before `handlePublish`:

```typescript
  function buildNewAdSetInput(): NewAdSetInput {
    return {
      campaignId: newAdSetForm.campaignId,
      name: newAdSetForm.name,
      budgetType: newAdSetForm.budgetType,
      budgetCents: Math.round(parseFloat(newAdSetForm.budgetAmount || "0") * 100),
      startTime: new Date(newAdSetForm.startDate).toISOString(),
      endTime: newAdSetForm.endDate
        ? new Date(newAdSetForm.endDate).toISOString()
        : undefined,
      optimizationGoal: newAdSetForm.optimizationGoal,
      bidStrategy: newAdSetForm.bidStrategy,
      bidAmountCents: newAdSetForm.bidAmount
        ? Math.round(parseFloat(newAdSetForm.bidAmount) * 100)
        : undefined,
      targeting: {
        geoCountries: newAdSetForm.geoCountries,
        ageMin: parseInt(newAdSetForm.ageMin, 10),
        ageMax: parseInt(newAdSetForm.ageMax, 10),
        genders:
          newAdSetForm.gender === "all"
            ? undefined
            : [newAdSetForm.gender === "male" ? 1 : 2],
        customAudiences: newAdSetForm.selectedAudiences.map(({ id, name }) => ({
          id,
          name,
        })),
      },
      placementMode: newAdSetForm.placementMode,
      publisherPlatforms: newAdSetForm.publisherPlatforms,
      facebookPositions: newAdSetForm.facebookPositions,
      instagramPositions: newAdSetForm.instagramPositions,
    };
  }
```

- [ ] **Step 4: Update `handlePublish` to pass `newAdSet` when in "new" mode**

In `handlePublish`, update the fetch body:

```typescript
      body: JSON.stringify({
        brand: "winespies",
        adSetId: destinationMode === "existing" ? selectedAdSetId : null,
        newAdSet: destinationMode === "new" ? buildNewAdSetInput() : undefined,
        jobs: publishJobs,
      }),
```

Also validate before publishing in "new" mode — add this guard at the top of `handlePublish`, after the `if (!selectedAdSetId)` check:

```typescript
    if (destinationMode === "new" && (!newAdSetForm.campaignId || !newAdSetForm.name || !newAdSetForm.budgetAmount)) {
      return;
    }
```

- [ ] **Step 5: Replace the "Destination Ad Set" section in JSX**

Find the `<div className="border border-border rounded-xl p-4 ...">` block that contains the ad set selector. Replace the entire block with:

```tsx
      <div className="border border-border rounded-xl p-4 flex flex-col gap-4 bg-surface">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-foreground">
            Destination Ad Set
          </div>
          <div className="flex gap-1">
            {(["existing", "new"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setDestinationMode(m)}
                className={`px-3 py-1 text-xs rounded-lg border transition-colors ${
                  destinationMode === m
                    ? "border-accent bg-accent/10 text-accent font-medium"
                    : "border-border text-muted hover:text-foreground"
                }`}
              >
                {m === "existing" ? "Use existing" : "Create new"}
              </button>
            ))}
          </div>
        </div>

        {destinationMode === "existing" && (
          <>
            {adSetsLoading ? (
              <div className="text-sm text-muted">Loading ad sets…</div>
            ) : adSetsError ? (
              <div className="text-sm text-danger">{adSetsError}</div>
            ) : (
              <select
                value={selectedAdSetId}
                onChange={(e) => setSelectedAdSetId(e.target.value)}
                className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-accent"
              >
                {adSets.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name} ({s.effective_status})
                  </option>
                ))}
              </select>
            )}
          </>
        )}

        {destinationMode === "new" && (
          <NewAdSetForm
            campaigns={campaigns}
            audiences={audiences}
            value={newAdSetForm}
            onChange={(updates) =>
              setNewAdSetForm((prev) => ({ ...prev, ...updates }))
            }
          />
        )}
      </div>
```

- [ ] **Step 6: Update the publish button label and disabled logic**

Find the publish button. Update its `disabled` prop and label:

```tsx
          disabled={
            publishing ||
            anyPublishing ||
            preflight?.ok === false ||
            (destinationMode === "existing" && !selectedAdSetId) ||
            (destinationMode === "new" &&
              (!newAdSetForm.campaignId ||
                !newAdSetForm.name ||
                !newAdSetForm.budgetAmount))
          }
```

Update the button text:

```tsx
            {publishing
              ? destinationMode === "new"
                ? "Creating ad set…"
                : "Publishing…"
              : destinationMode === "new"
              ? `Create Ad Set & Publish ${jobs.length} Ad${jobs.length !== 1 ? "s" : ""}`
              : `Publish ${jobs.length} Ad${jobs.length !== 1 ? "s" : ""} to Meta`}
```

- [ ] **Step 7: Verify end-to-end**

Run `npm run dev`. Go through the full flow:
1. Select a wine → select 2 templates → Review Brief shows 2 ads ✓
2. Generate → 2 ads appear
3. Publish → Step 5 loads with "Use existing | Create new" toggle
4. "Use existing": existing ad set dropdown works as before
5. "Create new": form renders with all sections (identity, budget, optimization, targeting, placements)
6. Select a campaign + enter a name + enter a budget → "Create Ad Set & Publish" button becomes active
7. On any publish failure, error message is shown inline below the ad card with a Retry button

- [ ] **Step 8: Commit**

```bash
git add app/creative/pdp/components/PublishPanel.tsx
git commit -m "feat: PublishPanel mode toggle + NewAdSetForm integration + create-then-publish flow"
```

---

## Self-Review

**Spec coverage check:**
- ✅ Review Brief stub fix — Task 1
- ✅ Preflight banner — Task 5, Step 1–2
- ✅ Inline error display — Task 5, Step 3–4
- ✅ Retry button — Task 5, Step 3
- ✅ `fetchCampaignsLive` / `fetchAudiencesLive` / `createAdSet` — Task 2
- ✅ GET preflight/campaigns/audiences — Task 3
- ✅ POST handles `newAdSet` — Task 4
- ✅ Mode toggle (existing/new) — Task 7
- ✅ Full form: name, campaign, budget, schedule, optimization, bid strategy, audiences, geo, age, gender, placements — Task 6
- ✅ Default status PAUSED — Task 6 (hardcoded in `createAdSet`, noted in form footer)
- ✅ Publish button disabled when preflight fails — Task 5 Step 5, Task 7 Step 6

**Type consistency check:**
- `NewAdSetInput` defined in `lib/meta-publish.ts` (Task 2), imported in route (Task 4) and PublishPanel (Task 7) ✓
- `NewAdSetFormState` defined in `NewAdSetForm.tsx` (Task 6), imported in PublishPanel (Task 7) ✓
- `MetaCampaignLive`, `MetaAudience` defined in `lib/meta-publish.ts` (Task 2), imported in route (Task 3) and NewAdSetForm/PublishPanel (Tasks 6–7) ✓
- `resolveBatchMappings` signature changed in Task 1 Step 1, hook updated in Step 2, caller updated in Step 3 ✓
