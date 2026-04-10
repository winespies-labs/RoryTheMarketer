# Ads Manager Settings + PDP Bulk Publish Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add UTM tracking defaults and Creative Enhancement defaults to the Ads Manager Settings page (saved server-side), then improve the PDP Publish step with AI-generated per-wine copy and a per-wine adset mode.

**Architecture:** A new `lib/ad-settings.ts` module reads/writes `data/{brandId}/ad-settings.json`. All publish routes read settings automatically at publish time — no client config needed. The PDP publish step gains an adset mode toggle (shared vs. per-wine) and a Generate Copy button that calls Claude in parallel for all wines.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS 4, Anthropic SDK (`claude-sonnet-4-5`), Meta Graph API

---

## File Map

| File | Action | Purpose |
|------|--------|---------|
| `lib/ad-settings.ts` | Create | Types, enhancement lists, read/write settings, `applyUtm`, `buildDegreesOfFreedomSpec` |
| `app/api/ads/settings/route.ts` | Create | GET/POST handler for ad settings JSON |
| `app/ads-manager/settings/page.tsx` | Modify | Add UTM + Creative Enhancements sections |
| `lib/meta-publish.ts` | Modify | Add `degreesOfFreedomSpec` param to `createAdCreative` |
| `app/api/pdp/generate-copy/route.ts` | Create | Parallel Claude copy generation per wine |
| `app/api/pdp/publish/route.ts` | Modify | Apply UTM + enhancements, handle per-wine adsets |
| `app/creative/pdp/components/PublishPanel.tsx` | Modify | Generate Copy button + per-wine adset mode toggle |

---

## Task 1: lib/ad-settings.ts — Types, storage, and helpers

**Files:**
- Create: `lib/ad-settings.ts`

- [ ] **Step 1: Create the file**

```typescript
// lib/ad-settings.ts
import fs from "fs";
import path from "path";

// Enhancement definitions — used by Settings UI and publish route
export const IMAGE_ENHANCEMENTS = [
  { slug: "show_relevant_comments", label: "Show relevant comments" },
  { slug: "visual_touchups", label: "Visual touchups" },
  { slug: "text_improvements", label: "Text improvements" },
  { slug: "add_text_overlays", label: "Add text overlays" },
  { slug: "brightness_contrast", label: "Brightness & contrast" },
  { slug: "music", label: "Music" },
  { slug: "animation", label: "Animation" },
  { slug: "add_site_links", label: "Add site links" },
  { slug: "add_catalog_items", label: "Add catalog items" },
  { slug: "add_details", label: "Add details" },
  { slug: "enhance_cta", label: "Enhance CTA" },
  { slug: "reveal_details", label: "Reveal details" },
  { slug: "flex_media", label: "Flex media" },
  { slug: "translate_text", label: "Translate text" },
  { slug: "show_summaries", label: "Show summaries" },
  { slug: "show_spotlights", label: "Show spotlights" },
] as const;

export const VIDEO_ENHANCEMENTS = [
  { slug: "show_relevant_comments", label: "Show relevant comments" },
  { slug: "visual_touchups", label: "Visual touchups" },
  { slug: "text_improvements", label: "Text improvements" },
  { slug: "add_video_effects", label: "Add video effects" },
  { slug: "add_catalog_items", label: "Add catalog items" },
  { slug: "add_site_links", label: "Add site links" },
  { slug: "add_details", label: "Add details" },
  { slug: "enhance_cta", label: "Enhance CTA" },
  { slug: "reveal_details", label: "Reveal details" },
  { slug: "flex_media", label: "Flex media" },
  { slug: "translate_text", label: "Translate text" },
  { slug: "show_summaries", label: "Show summaries" },
  { slug: "show_spotlights", label: "Show spotlights" },
] as const;

export const CAROUSEL_ENHANCEMENTS = [
  { slug: "show_relevant_comments", label: "Show relevant comments" },
  { slug: "visual_touchups", label: "Visual touchups" },
  { slug: "profile_end_card", label: "Profile end card" },
  { slug: "highlight_card", label: "Highlight card" },
  { slug: "dynamic_description", label: "Dynamic description" },
  { slug: "adapt_multi_image", label: "Adapt multi-image" },
  { slug: "enhance_cta", label: "Enhance CTA" },
] as const;

export interface AdSettings {
  utm: {
    source: string;
    medium: string;
    campaign: string;
    content: string;
    rawOverride: string;
  };
  creativeEnhancements: {
    images: Record<string, boolean>;
    videos: Record<string, boolean>;
    carousel: Record<string, boolean>;
  };
}

const DEFAULT_SETTINGS: AdSettings = {
  utm: { source: "", medium: "", campaign: "", content: "", rawOverride: "" },
  creativeEnhancements: { images: {}, videos: {}, carousel: {} },
};

function settingsPath(brandId: string): string {
  return path.join(process.cwd(), "data", brandId, "ad-settings.json");
}

export function getAdSettings(brandId: string): AdSettings {
  try {
    const raw = fs.readFileSync(settingsPath(brandId), "utf-8");
    const parsed = JSON.parse(raw) as Partial<AdSettings>;
    return {
      utm: { ...DEFAULT_SETTINGS.utm, ...(parsed.utm ?? {}) },
      creativeEnhancements: {
        images: parsed.creativeEnhancements?.images ?? {},
        videos: parsed.creativeEnhancements?.videos ?? {},
        carousel: parsed.creativeEnhancements?.carousel ?? {},
      },
    };
  } catch {
    return {
      utm: { ...DEFAULT_SETTINGS.utm },
      creativeEnhancements: { images: {}, videos: {}, carousel: {} },
    };
  }
}

export function saveAdSettings(brandId: string, settings: AdSettings): void {
  const p = settingsPath(brandId);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, JSON.stringify(settings, null, 2), "utf-8");
}

/**
 * Appends UTM params to a URL. If rawOverride is set it is appended as-is
 * and the individual fields are ignored.
 */
export function applyUtm(url: string, utm: AdSettings["utm"]): string {
  if (utm.rawOverride.trim()) {
    const sep = url.includes("?") ? "&" : "?";
    return `${url}${sep}${utm.rawOverride.trim()}`;
  }
  const params: string[] = [];
  if (utm.source) params.push(`utm_source=${encodeURIComponent(utm.source)}`);
  if (utm.medium) params.push(`utm_medium=${encodeURIComponent(utm.medium)}`);
  if (utm.campaign) params.push(`utm_campaign=${encodeURIComponent(utm.campaign)}`);
  if (utm.content) params.push(`utm_content=${encodeURIComponent(utm.content)}`);
  if (!params.length) return url;
  const sep = url.includes("?") ? "&" : "?";
  return `${url}${sep}${params.join("&")}`;
}

/**
 * Builds a Meta degrees_of_freedom_spec from enabled enhancement slugs.
 * Returns undefined when no enhancements are enabled (omit field from API call).
 */
export function buildDegreesOfFreedomSpec(
  enhancements: Record<string, boolean>,
): Record<string, unknown> | undefined {
  const enabledSlugs = Object.entries(enhancements)
    .filter(([, v]) => v)
    .map(([k]) => k);
  if (!enabledSlugs.length) return undefined;
  const features: Record<string, { enroll_status: "OPT_IN" }> = {};
  for (const slug of enabledSlugs) {
    features[slug] = { enroll_status: "OPT_IN" };
  }
  return { creative_features_spec: features };
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/mikemeisner/Developer/RoryTheMarketer && npm run build 2>&1 | tail -20
```

Expected: no errors in `lib/ad-settings.ts`.

- [ ] **Step 3: Commit**

```bash
git add lib/ad-settings.ts
git commit -m "feat(ads): add ad-settings lib — types, storage, UTM helper, degrees-of-freedom builder"
```

---

## Task 2: app/api/ads/settings/route.ts — Settings API

**Files:**
- Create: `app/api/ads/settings/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// app/api/ads/settings/route.ts
import { NextRequest, NextResponse } from "next/server";
import { getBrand } from "@/lib/brands";
import { getAdSettings, saveAdSettings, type AdSettings } from "@/lib/ad-settings";

export async function GET(req: NextRequest) {
  const brand = new URL(req.url).searchParams.get("brand") ?? "winespies";
  if (!getBrand(brand)) {
    return NextResponse.json({ error: "Unknown brand" }, { status: 400 });
  }
  return NextResponse.json(getAdSettings(brand));
}

export async function POST(req: NextRequest) {
  const brand = new URL(req.url).searchParams.get("brand") ?? "winespies";
  if (!getBrand(brand)) {
    return NextResponse.json({ error: "Unknown brand" }, { status: 400 });
  }
  try {
    const settings = (await req.json()) as AdSettings;
    saveAdSettings(brand, settings);
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ error: "Invalid settings body" }, { status: 400 });
  }
}
```

- [ ] **Step 2: Build to verify**

```bash
npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors, route registered at `/api/ads/settings`.

- [ ] **Step 3: Commit**

```bash
git add app/api/ads/settings/route.ts
git commit -m "feat(ads): add GET/POST /api/ads/settings route"
```

---

## Task 3: app/ads-manager/settings/page.tsx — UTM + Creative Enhancements UI

**Files:**
- Modify: `app/ads-manager/settings/page.tsx`

This is a substantial UI addition. The existing file is 186 lines. We add UTM and Creative Enhancements sections below the existing content.

- [ ] **Step 1: Add imports and new state**

At the top of the file, add to the existing imports:

```typescript
import {
  type AdSettings,
  IMAGE_ENHANCEMENTS,
  VIDEO_ENHANCEMENTS,
  CAROUSEL_ENHANCEMENTS,
} from "@/lib/ad-settings";
```

Inside `SettingsPage()`, after the existing state declarations (after `const [saved, setSaved] = useState(false);`), add:

```typescript
const [adSettings, setAdSettings] = useState<AdSettings>({
  utm: { source: "", medium: "", campaign: "", content: "", rawOverride: "" },
  creativeEnhancements: { images: {}, videos: {}, carousel: {} },
});
const [adSettingsSaving, setAdSettingsSaving] = useState(false);
const [adSettingsSaved, setAdSettingsSaved] = useState(false);
```

- [ ] **Step 2: Add load effect for ad settings**

After the existing `useEffect(() => { fetchInfo(); }, [fetchInfo]);` block, add:

```typescript
useEffect(() => {
  fetch("/api/ads/settings?brand=winespies")
    .then((r) => r.json())
    .then((data: AdSettings) => setAdSettings(data))
    .catch(() => {});
}, []);
```

- [ ] **Step 3: Add save handler for ad settings**

After the existing `saveDefaults` function, add:

```typescript
const saveAdSettingsToServer = async () => {
  setAdSettingsSaving(true);
  try {
    await fetch("/api/ads/settings?brand=winespies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(adSettings),
    });
    setAdSettingsSaved(true);
    setTimeout(() => setAdSettingsSaved(false), 2000);
  } catch {
    // silent — user can retry
  } finally {
    setAdSettingsSaving(false);
  }
};
```

- [ ] **Step 4: Add toggle helper**

Add this inside the component, after `saveAdSettingsToServer`:

```typescript
function toggleEnhancement(
  type: "images" | "videos" | "carousel",
  slug: string,
) {
  setAdSettings((prev) => ({
    ...prev,
    creativeEnhancements: {
      ...prev.creativeEnhancements,
      [type]: {
        ...prev.creativeEnhancements[type],
        [slug]: !prev.creativeEnhancements[type][slug],
      },
    },
  }));
}
```

- [ ] **Step 5: Widen the outer wrapper and add UTM section**

Change the outer `<div className="max-w-2xl space-y-6">` to `<div className="max-w-5xl space-y-6">`.

Then, after the closing `</div>` of the existing "Ad Defaults" section (line 183), add the UTM section:

```tsx
{/* UTM Tracking */}
<div className="bg-surface border border-border rounded-lg p-5">
  <h2 className="text-sm font-semibold mb-1">UTM Tracking</h2>
  <p className="text-xs text-muted mb-4">
    Applied automatically to destination URLs on every published ad.
    Raw override takes precedence over individual fields when set.
  </p>
  <div className="grid grid-cols-2 gap-3 mb-3">
    {(
      [
        { key: "source", label: "Source", placeholder: "facebook" },
        { key: "medium", label: "Medium", placeholder: "paid" },
        { key: "campaign", label: "Campaign", placeholder: "{{campaign.name}}" },
        { key: "content", label: "Content", placeholder: "{{ad.name}}" },
      ] as const
    ).map(({ key, label, placeholder }) => (
      <div key={key}>
        <label className="block text-xs font-medium text-muted mb-1">{label}</label>
        <input
          type="text"
          value={adSettings.utm[key]}
          onChange={(e) =>
            setAdSettings((prev) => ({
              ...prev,
              utm: { ...prev.utm, [key]: e.target.value },
            }))
          }
          placeholder={placeholder}
          className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent bg-background"
        />
      </div>
    ))}
  </div>
  <div className="mb-4">
    <label className="block text-xs font-medium text-muted mb-1">
      Raw override <span className="font-normal">(overrides fields above when set)</span>
    </label>
    <textarea
      value={adSettings.utm.rawOverride}
      onChange={(e) =>
        setAdSettings((prev) => ({
          ...prev,
          utm: { ...prev.utm, rawOverride: e.target.value },
        }))
      }
      placeholder="utm_source=facebook&utm_medium=paid&utm_campaign={{campaign.name}}"
      rows={2}
      className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent bg-background resize-none font-mono"
    />
  </div>
</div>
```

- [ ] **Step 6: Add Creative Enhancements section**

After the UTM section, add:

```tsx
{/* Creative Enhancements */}
<div className="bg-surface border border-border rounded-lg p-5">
  <h2 className="text-sm font-semibold mb-1">Creative Enhancements</h2>
  <p className="text-xs text-muted mb-4">
    Meta may apply these to improve ad performance. Toggle off to prevent specific modifications.
    Applied to all ads published from this app.
  </p>
  <div className="grid grid-cols-3 gap-6">
    {(
      [
        { key: "images" as const, label: "Images", items: IMAGE_ENHANCEMENTS },
        { key: "videos" as const, label: "Videos", items: VIDEO_ENHANCEMENTS },
        { key: "carousel" as const, label: "Carousel", items: CAROUSEL_ENHANCEMENTS },
      ]
    ).map(({ key, label, items }) => (
      <div key={key}>
        <div className="text-xs font-semibold text-foreground mb-3">{label}</div>
        <div className="space-y-2.5">
          {items.map(({ slug, label: itemLabel }) => (
            <div key={slug} className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted">{itemLabel}</span>
              <button
                type="button"
                onClick={() => toggleEnhancement(key, slug)}
                className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${
                  adSettings.creativeEnhancements[key][slug]
                    ? "bg-accent"
                    : "bg-border"
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                    adSettings.creativeEnhancements[key][slug]
                      ? "translate-x-4"
                      : "translate-x-0.5"
                  }`}
                />
              </button>
            </div>
          ))}
        </div>
      </div>
    ))}
  </div>
</div>
```

- [ ] **Step 7: Add Save Ad Settings button**

After the Creative Enhancements closing `</div>`, add:

```tsx
<div className="flex items-center gap-3">
  <button
    onClick={saveAdSettingsToServer}
    disabled={adSettingsSaving}
    className="px-4 py-1.5 text-sm font-medium bg-accent text-white rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity"
  >
    {adSettingsSaving ? "Saving…" : "Save Ad Settings"}
  </button>
  {adSettingsSaved && <span className="text-sm text-success">Saved</span>}
</div>
```

- [ ] **Step 8: Build and verify**

```bash
npm run build 2>&1 | tail -30
```

Expected: no TypeScript errors, `/ads-manager/settings` compiles cleanly.

- [ ] **Step 9: Commit**

```bash
git add app/ads-manager/settings/page.tsx
git commit -m "feat(ads): add UTM tracking and Creative Enhancements sections to settings page"
```

---

## Task 4: lib/meta-publish.ts — Add degreesOfFreedomSpec to createAdCreative

**Files:**
- Modify: `lib/meta-publish.ts:96-143`

- [ ] **Step 1: Add optional param to createAdCreative input type**

Find the `createAdCreative` function (line 96). Update the `input` type to add the optional field:

```typescript
export async function createAdCreative(
  brandId: string,
  input: {
    name: string;
    imageHash: string;
    primaryText: string;
    headline: string;
    description: string;
    link: string;
    ctaType?: string;
    degreesOfFreedomSpec?: Record<string, unknown>;
  },
): Promise<CreateCreativeResult> {
```

- [ ] **Step 2: Pass degreesOfFreedomSpec to the API call**

Find the `graphPost` call in `createAdCreative` (around line 130). Replace it with:

```typescript
  const body: Record<string, unknown> = {
    name: input.name,
    object_story_spec: objectStorySpec,
  };
  if (input.degreesOfFreedomSpec) {
    body.degrees_of_freedom_spec = JSON.stringify(input.degreesOfFreedomSpec);
  }

  const result = await graphPost<{ id: string }>(
    `${accountId}/adcreatives`,
    body,
  );
```

The full `createAdCreative` body (lines 115–142) should now look like:

```typescript
  const objectStorySpec = JSON.stringify({
    page_id: pageId,
    link_data: {
      image_hash: input.imageHash,
      message: input.primaryText,
      link: input.link,
      name: input.headline,
      description: input.description,
      call_to_action: {
        type: input.ctaType ?? "SHOP_NOW",
        value: { link: input.link },
      },
    },
  });

  const body: Record<string, unknown> = {
    name: input.name,
    object_story_spec: objectStorySpec,
  };
  if (input.degreesOfFreedomSpec) {
    body.degrees_of_freedom_spec = JSON.stringify(input.degreesOfFreedomSpec);
  }

  const result = await graphPost<{ id: string }>(
    `${accountId}/adcreatives`,
    body,
  );

  if (!result.id) {
    throw new Error("Failed to create ad creative — no ID returned");
  }

  return { id: result.id };
```

- [ ] **Step 3: Build to verify**

```bash
npm run build 2>&1 | tail -20
```

Expected: no errors. All existing call sites pass no `degreesOfFreedomSpec` — they're unaffected.

- [ ] **Step 4: Commit**

```bash
git add lib/meta-publish.ts
git commit -m "feat(ads): add optional degreesOfFreedomSpec to createAdCreative"
```

---

## Task 5: app/api/pdp/generate-copy/route.ts — AI copy generation

**Files:**
- Create: `app/api/pdp/generate-copy/route.ts`

- [ ] **Step 1: Create the route**

```typescript
// app/api/pdp/generate-copy/route.ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getContextBundle } from "@/lib/context-bundle";

export const maxDuration = 60;

interface WineInput {
  saleId: number;
  wineName: string;
  score?: string;
  pullQuote?: string;
  salePrice?: string;
  retailPrice?: string;
}

interface WineCopy {
  saleId: number;
  headline: string;
  primaryText: string;
  description: string;
}

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { brand?: string; wines: WineInput[] };
  const brand = body.brand ?? "winespies";

  if (!Array.isArray(body.wines) || body.wines.length === 0) {
    return NextResponse.json({ error: "wines array required" }, { status: 400 });
  }

  const contextBundle = await getContextBundle(brand);

  const systemPrompt = `You are a skilled direct-response copywriter for Wine Spies, a members-only wine e-commerce brand. Write compelling, deal-driven Facebook ad copy.

Brand context:
${JSON.stringify(contextBundle, null, 2)}

Rules:
- Headline: max 125 characters, specific to this wine, highlight deal or quality
- primaryText: 2-3 sentences in Wine Spies voice — urgency, value, quality cues
- description: max 30 characters, short punchy tagline
- Return ONLY a valid JSON object: { "headline": "...", "primaryText": "...", "description": "..." }
- No markdown, no explanation, no extra text`;

  const copies: WineCopy[] = await Promise.all(
    body.wines.map(async (wine): Promise<WineCopy> => {
      const userPrompt = `Write Facebook ad copy for this wine:

Wine: ${wine.wineName}${wine.score ? `\nScore: ${wine.score}` : ""}${wine.pullQuote ? `\nDescription: ${wine.pullQuote}` : ""}${wine.salePrice ? `\nSale Price: ${wine.salePrice}` : ""}${wine.retailPrice ? `\nRetail Price: ${wine.retailPrice}` : ""}`;

      try {
        const msg = await client.messages.create({
          model: "claude-sonnet-4-5",
          max_tokens: 400,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        });

        const text =
          msg.content[0].type === "text" ? msg.content[0].text.trim() : "";
        const parsed = JSON.parse(text) as {
          headline?: string;
          primaryText?: string;
          description?: string;
        };

        return {
          saleId: wine.saleId,
          headline: (parsed.headline ?? wine.wineName).slice(0, 125),
          primaryText:
            parsed.primaryText ??
            `${wine.wineName} — now just ${wine.salePrice}. Shop before it's gone.`,
          description: (parsed.description ?? "Shop Wine Spies →").slice(0, 30),
        };
      } catch {
        // Fallback copy if Claude fails or returns invalid JSON
        return {
          saleId: wine.saleId,
          headline: wine.wineName.slice(0, 125),
          primaryText:
            wine.pullQuote ??
            `${wine.wineName} — now just ${wine.salePrice}. Limited time.`,
          description: "Shop Wine Spies →",
        };
      }
    }),
  );

  return NextResponse.json({ copies });
}
```

- [ ] **Step 2: Build to verify**

```bash
npm run build 2>&1 | tail -20
```

Expected: no errors, route registered at `/api/pdp/generate-copy`.

- [ ] **Step 3: Commit**

```bash
git add app/api/pdp/generate-copy/route.ts
git commit -m "feat(pdp): add generate-copy route — parallel Claude copy gen per wine"
```

---

## Task 6: app/api/pdp/publish/route.ts — UTM, enhancements, per-wine adsets

**Files:**
- Modify: `app/api/pdp/publish/route.ts`

- [ ] **Step 1: Add imports**

At the top, add to existing imports:

```typescript
import { getAdSettings, applyUtm, buildDegreesOfFreedomSpec } from "@/lib/ad-settings";
```

- [ ] **Step 2: Add PerWineAdSetDefaults type and update PublishRequest**

Find the `PublishRequest` interface (line 81) and update it:

```typescript
interface PerWineAdSetDefaults {
  campaignId: string;
  budgetCents: number;
  bidStrategy: "LOWEST_COST_WITHOUT_CAP" | "COST_CAP" | "BID_CAP";
  bidAmountCents?: number;
}

interface PublishRequest {
  brand: string;
  adSetId: string | null;
  newAdSet?: NewAdSetInput;
  perWineAdSetDefaults?: PerWineAdSetDefaults;
  jobs: PublishJob[];
}
```

- [ ] **Step 3: Read settings and update the POST handler**

In the `POST` function body, after `const { brand, adSetId, newAdSet, jobs } = body;`, add:

```typescript
  const { perWineAdSetDefaults } = body;
  const adSettings = getAdSettings(brand);
  const degreesOfFreedomSpec = buildDegreesOfFreedomSpec(
    adSettings.creativeEnhancements.images,
  );
```

- [ ] **Step 4: Update adset resolution logic**

Replace the existing adset resolution block (lines 102–122):

```typescript
  // In per-wine mode, adsets are created per job below — skip shared resolution
  let sharedAdSetId: string | null = null;
  if (!perWineAdSetDefaults) {
    sharedAdSetId = adSetId;
    if (!sharedAdSetId) {
      if (!newAdSet) {
        return NextResponse.json(
          { error: "Must provide adSetId, newAdSet, or perWineAdSetDefaults" },
          { status: 400 },
        );
      }
      try {
        const { id } = await createAdSet(brand, newAdSet);
        sharedAdSetId = id;
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Failed to create ad set";
        return NextResponse.json(
          { error: `Ad set creation failed: ${msg}` },
          { status: 500 },
        );
      }
    }
  }
```

- [ ] **Step 5: Update the per-job publish loop**

Replace the existing `Promise.all` jobs loop (lines 128–153) with:

```typescript
  const results = await Promise.all(
    jobs.map(async (job) => {
      try {
        // Resolve adset — create per-wine if in that mode
        let resolvedAdSetId = sharedAdSetId as string;
        if (perWineAdSetDefaults) {
          const { id } = await createAdSet(brand, {
            campaignId: perWineAdSetDefaults.campaignId,
            name: job.wineName,
            budgetType: "daily",
            budgetCents: perWineAdSetDefaults.budgetCents,
            startTime: new Date().toISOString(),
            optimizationGoal: "OFFSITE_CONVERSIONS",
            bidStrategy: perWineAdSetDefaults.bidStrategy,
            bidAmountCents: perWineAdSetDefaults.bidAmountCents,
            targeting: { geoCountries: ["US"], ageMin: 21, ageMax: 65 },
            placementMode: "automatic",
          });
          resolvedAdSetId = id;
        }

        // Apply UTM to destination URL
        const link = applyUtm(job.saleUrl, adSettings.utm);

        const { hash } = await uploadAdImage(brand, job.imageBase64);
        const { id: creativeId } = await createAdCreative(brand, {
          name: `PDP — ${job.wineName}`,
          imageHash: hash,
          primaryText: job.primary_text,
          headline: job.headline,
          description: job.description,
          link,
          ctaType: "SHOP_NOW",
          degreesOfFreedomSpec,
        });
        const { id: adId } = await createAd(brand, {
          name: `PDP — ${job.wineName}`,
          adsetId: resolvedAdSetId,
          creativeId,
          status: "ACTIVE",
        });
        return { jobId: job.jobId, success: true as const, adId };
      } catch (err) {
        const msg = err instanceof Error ? err.message : "Publish failed";
        return { jobId: job.jobId, success: false as const, error: msg };
      }
    }),
  );
```

- [ ] **Step 6: Build to verify**

```bash
npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors.

- [ ] **Step 7: Commit**

```bash
git add app/api/pdp/publish/route.ts
git commit -m "feat(pdp): apply UTM + creative enhancements on publish, support per-wine adsets"
```

---

## Task 7: app/creative/pdp/components/PublishPanel.tsx — Generate Copy + per-wine adset toggle

**Files:**
- Modify: `app/creative/pdp/components/PublishPanel.tsx`

This is the largest UI change. Read the full file before editing. Changes: adset mode toggle at top, Generate Copy button, per-wine adset defaults form, updated `handlePublish`.

- [ ] **Step 1: Add new state declarations**

Inside `PublishPanel`, after `const [newAdSetForm, setNewAdSetForm] = useState(...)` (line 73), add:

```typescript
  // Adset mode: shared (all wines → one adset) vs per-wine (one adset per wine)
  const [adsetMode, setAdsetMode] = useState<"shared" | "per-wine">("shared");

  // Per-wine adset defaults form
  const [perWineDefaults, setPerWineDefaults] = useState({
    campaignId: "",
    budgetAmount: "",
    bidStrategy: "LOWEST_COST_WITHOUT_CAP" as
      | "LOWEST_COST_WITHOUT_CAP"
      | "COST_CAP"
      | "BID_CAP",
    bidAmount: "",
  });

  // AI copy generation
  const [generatingCopy, setGeneratingCopy] = useState(false);
  const [copyGenError, setCopyGenError] = useState<string | null>(null);
```

- [ ] **Step 2: Add generateCopy function**

After the `updateCopy` function, add:

```typescript
  async function generateCopy() {
    setGeneratingCopy(true);
    setCopyGenError(null);
    try {
      const wines = jobs.map((job) => ({
        saleId: job.saleId,
        wineName: job.wineName,
        salePrice: "",   // PublishPanel doesn't have price — use wine name only
        retailPrice: "",
      }));
      const res = await fetch("/api/pdp/generate-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand: "winespies", wines }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        copies: Array<{
          saleId: number;
          headline: string;
          primaryText: string;
          description: string;
        }>;
      };
      setJobStates((prev) => {
        const next = { ...prev };
        for (const copy of data.copies) {
          const jobId = jobs.find((j) => j.saleId === copy.saleId)?.id;
          if (jobId && next[jobId]) {
            next[jobId] = {
              ...next[jobId],
              copy: {
                headline: copy.headline,
                primary_text: copy.primaryText,
                description: copy.description,
              },
            };
          }
        }
        return next;
      });
    } catch (err) {
      setCopyGenError(
        err instanceof Error ? err.message : "Copy generation failed",
      );
    } finally {
      setGeneratingCopy(false);
    }
  }

  async function regenerateCopyForJob(jobId: string) {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;
    try {
      const res = await fetch("/api/pdp/generate-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: "winespies",
          wines: [{ saleId: job.saleId, wineName: job.wineName, salePrice: "", retailPrice: "" }],
        }),
      });
      if (!res.ok) return;
      const data = (await res.json()) as {
        copies: Array<{ saleId: number; headline: string; primaryText: string; description: string }>;
      };
      const copy = data.copies[0];
      if (copy) {
        setJobStates((prev) => ({
          ...prev,
          [jobId]: {
            ...prev[jobId],
            copy: {
              headline: copy.headline,
              primary_text: copy.primaryText,
              description: copy.description,
            },
          },
        }));
      }
    } catch {
      // silent — user can retry
    }
  }
```

- [ ] **Step 3: Update handlePublish for per-wine mode**

Replace the existing `handlePublish` function with:

```typescript
  async function handlePublish() {
    if (adsetMode === "shared") {
      if (!selectedAdSetId && destinationMode === "existing") return;
      if (
        destinationMode === "new" &&
        (!newAdSetForm.campaignId || !newAdSetForm.name || !newAdSetForm.budgetAmount)
      ) return;
    }
    if (adsetMode === "per-wine" && !perWineDefaults.campaignId) return;

    setPublishing(true);

    const publishJobs = jobs
      .filter((job): job is typeof job & { imageBase64: string } => !!job.imageBase64)
      .map((job) => ({
        jobId: job.id,
        imageBase64: job.imageBase64,
        mimeType: job.mimeType,
        wineName: job.wineName,
        ...jobStates[job.id].copy,
        saleUrl: `https://winespies.com/sales/${job.saleId}`,
      }));

    setJobStates((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([id, state]) => [
          id,
          { ...state, status: "publishing" as PublishStatus },
        ]),
      ),
    );

    try {
      const body: Record<string, unknown> = {
        brand: "winespies",
        jobs: publishJobs,
      };

      if (adsetMode === "per-wine") {
        body.perWineAdSetDefaults = {
          campaignId: perWineDefaults.campaignId,
          budgetCents: Math.round(
            parseFloat(perWineDefaults.budgetAmount || "0") * 100,
          ),
          bidStrategy: perWineDefaults.bidStrategy,
          bidAmountCents: perWineDefaults.bidAmount
            ? Math.round(parseFloat(perWineDefaults.bidAmount) * 100)
            : undefined,
        };
        body.adSetId = null;
      } else {
        body.adSetId =
          destinationMode === "existing" ? selectedAdSetId : null;
        body.newAdSet =
          destinationMode === "new" ? buildNewAdSetInput() : undefined;
      }

      const res = await fetch("/api/pdp/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = (await res.json()) as {
        results: Array<{
          jobId: string;
          success: boolean;
          adId?: string;
          error?: string;
        }>;
      };

      setJobStates((prev) => {
        const next = { ...prev };
        for (const r of data.results ?? []) {
          next[r.jobId] = {
            ...next[r.jobId],
            status: r.success ? "done" : "error",
            metaAdId: r.adId,
            error: r.error,
          };
        }
        return next;
      });
    } catch (err) {
      setJobStates((prev) =>
        Object.fromEntries(
          Object.entries(prev).map(([id, state]) => [
            id,
            {
              ...state,
              status: "error" as PublishStatus,
              error:
                err instanceof Error ? err.message : "Failed",
            },
          ]),
        ),
      );
    } finally {
      setPublishing(false);
    }
  }
```

- [ ] **Step 4: Update the JSX — header area with Generate Copy button**

Find the header block (around line 330–343). After the description paragraph, add the Generate Copy button:

```tsx
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Publish to Meta</h2>
          <p className="text-sm text-muted mt-0.5">
            Generate copy for each ad, choose an ad set, and publish.
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={generateCopy}
            disabled={generatingCopy || publishing}
            className="px-3 py-2 bg-surface border border-border text-foreground text-sm font-medium rounded-lg hover:bg-background transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generatingCopy ? "Generating…" : "✦ Generate Copy"}
          </button>
          <button
            onClick={onBack}
            className="px-3 py-2 text-sm text-muted hover:text-foreground transition-colors"
          >
            ← Back
          </button>
        </div>
      </div>
      {copyGenError && (
        <div className="px-3 py-2 bg-danger/10 text-danger text-xs rounded-lg">
          {copyGenError}
        </div>
      )}
```

- [ ] **Step 5: Update the destination section — add adset mode toggle**

Replace the existing destination section (the `<div className="border border-border rounded-xl p-4 ...">` block) with:

```tsx
      <div className="border border-border rounded-xl p-4 flex flex-col gap-4 bg-surface">
        {/* Adset mode toggle */}
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-foreground">Ad Set</div>
          <div className="flex gap-1">
            {(["shared", "per-wine"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setAdsetMode(m)}
                className={`px-3 py-1 text-xs rounded-lg border transition-colors ${
                  adsetMode === m
                    ? "border-accent bg-accent/10 text-accent font-medium"
                    : "border-border text-muted hover:text-foreground"
                }`}
              >
                {m === "shared" ? "All in one adset" : "One adset per wine"}
              </button>
            ))}
          </div>
        </div>

        {/* Shared mode — existing behavior */}
        {adsetMode === "shared" && (
          <>
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
          </>
        )}

        {/* Per-wine mode */}
        {adsetMode === "per-wine" && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-muted">
              One adset will be created per wine, named after the wine. All under the selected campaign.
            </p>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Campaign</label>
              <select
                value={perWineDefaults.campaignId}
                onChange={(e) =>
                  setPerWineDefaults((prev) => ({ ...prev, campaignId: e.target.value }))
                }
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="">Select campaign…</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Daily Budget ($)</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={perWineDefaults.budgetAmount}
                  onChange={(e) =>
                    setPerWineDefaults((prev) => ({ ...prev, budgetAmount: e.target.value }))
                  }
                  placeholder="50"
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Bid Strategy</label>
                <select
                  value={perWineDefaults.bidStrategy}
                  onChange={(e) =>
                    setPerWineDefaults((prev) => ({
                      ...prev,
                      bidStrategy: e.target.value as typeof perWineDefaults.bidStrategy,
                    }))
                  }
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="LOWEST_COST_WITHOUT_CAP">Lowest cost</option>
                  <option value="COST_CAP">Cost cap</option>
                  <option value="BID_CAP">Bid cap</option>
                </select>
              </div>
            </div>
            {perWineDefaults.bidStrategy !== "LOWEST_COST_WITHOUT_CAP" && (
              <div>
                <label className="block text-xs font-medium text-muted mb-1">
                  {perWineDefaults.bidStrategy === "COST_CAP" ? "Cost cap ($)" : "Bid cap ($)"}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={perWineDefaults.bidAmount}
                  onChange={(e) =>
                    setPerWineDefaults((prev) => ({ ...prev, bidAmount: e.target.value }))
                  }
                  placeholder="25.00"
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
            )}
          </div>
        )}
      </div>
```

- [ ] **Step 6: Add per-wine regenerate button to each job row**

Inside the job map, find the wine name / style line area (around line 418). After the `<div className="text-xs text-muted">{job.styleName}</div>` line, add:

```tsx
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-muted">{job.styleName}</span>
                    {state.status !== "done" && (
                      <button
                        type="button"
                        onClick={() => regenerateCopyForJob(job.id)}
                        title="Regenerate copy for this wine"
                        className="text-[10px] text-accent hover:underline"
                      >
                        ↺ Copy
                      </button>
                    )}
                  </div>
```

(Remove the original standalone `<div className="text-xs text-muted">{job.styleName}</div>` line and replace with the block above.)

- [ ] **Step 7: Update Publish button disabled logic**

Find the Publish button's `disabled` prop (around line 492). Replace the disabled expression:

```tsx
            disabled={
              publishing ||
              anyPublishing ||
              preflight?.ok === false ||
              (adsetMode === "shared" &&
                destinationMode === "existing" &&
                !selectedAdSetId) ||
              (adsetMode === "shared" &&
                destinationMode === "new" &&
                (!newAdSetForm.campaignId ||
                  !newAdSetForm.name ||
                  !newAdSetForm.budgetAmount)) ||
              (adsetMode === "per-wine" &&
                (!perWineDefaults.campaignId || !perWineDefaults.budgetAmount))
            }
```

- [ ] **Step 8: Update Publish button label**

Find the button label text (around line 503). Replace it:

```tsx
            {publishing
              ? adsetMode === "per-wine"
                ? "Creating adsets & publishing…"
                : destinationMode === "new"
                ? "Creating ad set…"
                : "Publishing…"
              : adsetMode === "per-wine"
              ? `Create ${jobs.length} Adset${jobs.length !== 1 ? "s" : ""} & Publish`
              : destinationMode === "new"
              ? `Create Ad Set & Publish ${jobs.length} Ad${jobs.length !== 1 ? "s" : ""}`
              : `Publish ${jobs.length} Ad${jobs.length !== 1 ? "s" : ""} to Meta`}
```

- [ ] **Step 9: Build and verify**

```bash
npm run build 2>&1 | tail -30
```

Expected: clean build, no TypeScript errors across all modified files.

- [ ] **Step 10: Manual smoke test checklist**

1. Run `npm run dev`
2. Navigate to `/ads-manager/settings`
3. Confirm UTM section renders with 4 inputs + raw override textarea
4. Confirm Creative Enhancements renders 3 columns of toggles
5. Toggle some enhancements on, click "Save Ad Settings", reload — confirm they persist
6. Navigate to `/creative/pdp`, generate some ads, reach step 5 (Publish)
7. Confirm "✦ Generate Copy" button appears in the header
8. Click it — confirm all copy fields get pre-filled
9. Confirm the adset mode toggle shows "All in one adset" and "One adset per wine"
10. Switch to "One adset per wine" — confirm campaign picker + budget form appears
11. Switch back to "All in one adset" — confirm original adset picker returns

- [ ] **Step 11: Commit**

```bash
git add app/creative/pdp/components/PublishPanel.tsx
git commit -m "feat(pdp): add Generate Copy button and per-wine adset mode to PublishPanel"
```
