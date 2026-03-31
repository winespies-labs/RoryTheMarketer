# Facebook Ads Manager — Implementation Plan

This doc plans adding an in-app **Ads Manager** that replaces (or complements) Facebook’s Ads Manager and tools like AdNova/Foreplay for *managing* ads: reporting, inline edits (budgets, bid caps), sync from Meta, and publishing ads from a Workshop. It is based on a “vibe coded” Facebook Ads Manager (reference: Pediment OS–style Social Ads UI) and aligned with Rory’s existing stack and patterns. Refinements from that reference UI are incorporated (Chart | Cards tabs, Peabot on report pages, Workshop status/preview/iterative AI).

---

## What we already have

- **Meta Graph:** `lib/meta-graph.ts` — `graphGet`, `graphGetAllPages`, `META_ACCESS_TOKEN`.
- **Meta Marketing (read-only):** `lib/meta-marketing.ts` — `fetchRunningAdsWithStoryIds(act_xxx)` for ad→post mapping (comments sync). No campaigns/ad sets/insights yet.
- **Brands:** `metaAdAccountId` per brand, `getBrand()`, `getBrandDataDir(brandId)`.
- **Ad Builder:** Multi-step flow (Select reference ad → Configure → Generate images/copy). No “publish to Facebook” yet.
- **Chat:** `/chat` + `/api/chat` with brand-scoped history; can be extended or mirrored for “Peabot” over ad data.
- **Context Hub:** Brand switcher, panels for reviews, Meta comments, competitor ads.

---

## Target experience (from transcript)

| Area | Features |
|------|----------|
| **Reports** | Campaigns → Ad sets → Ads drill-down; top-level KPIs; card view (top 5 by metric); chart view over time; time range selector; hover = thumbnail preview. |
| **Inline management** | Edit daily budget, bid cap in the UI; changes pushed to Facebook (replaces doing it in Ads Manager). |
| **Data sync** | Periodic sync from Meta (e.g. “today” every 30 min; full 7/14-day sync); store in app so UI is fast and we can query. |
| **Filtering / sorting** | Filter by name (contains/doesn’t contain); sort columns; card view reflects sort (e.g. top 5 by revenue or ROAS). |
| **Creatives analysis** | Creatives view with thresholds (e.g. min spend $500), top N by ROAS over 90 days. |
| **Peabot** | Q&A over ad data (“what was top ad creative last week?”); has access to synced campaign/ad set/ad DB. |
| **AI suggestions** | Daily job: scan account, suggest changes (e.g. “this ad set is unprofitable, raise ROAS floor 2.5→3”); Apply = push to Facebook. Weekly job: 14-day lookback, bigger changes. |
| **Workshop** | Full ad composer: headline, primary text, description, CTA, URL, creatives (images/video); AI image gen (e.g. existing Gemini); drag-drop assets; **Publish to Facebook** (choose campaign/ad set, then push — standalone or flexible format). |
| **Settings** | Creative enhancement defaults (image/video/carousel options) so every pushed ad uses them without re-setting in FB. |

---

## High-level architecture

- **Storage:** Per-brand under `data/{brandId}/`: e.g. `meta-campaigns.json`, `meta-adsets.json`, `meta-ads.json` (or one `meta-account-snapshot.json`) with `syncedAt`, time range, and nested or keyed entities. Optional: SQLite/Postgres later for Peabot if query complexity grows.
- **Read:** Meta Marketing API — `GET /act_xxx/campaigns`, `.../adsets`, `.../ads` with `fields` and `insights` (with `time_range`). Use existing `graphGet` / `graphGetAllPages`.
- **Write:** `POST /{campaign_id}` or `/{adset_id}` with `daily_budget`, `bid_strategy`, etc. Need token with `ads_management`.
- **Sync:** Cron or on-demand routes that fetch and write to `data/{brandId}/`. Same pattern as Trustpilot/Meta comments sync.
- **UI:** New section under nav: “Ads Manager” with sub-routes: Campaigns, Ad sets, Creatives, Workshop, Settings. Brand from context (e.g. brand switcher or `?brand=`).

---

## Phase 6A: Meta account sync and storage

**Goal:** Pull campaigns, ad sets, and ads (with insights) from Meta and store per brand so the app can show reports and power Peabot.

### 6A.1 Marketing API client (read)

- **Extend** `lib/meta-marketing.ts` (or add `lib/meta-ads-manager.ts`):
  - `getAdAccountId(brandId)` — already exists; reuse.
  - **Campaigns:** `GET /{accountId}/campaigns` with `fields=id,name,status,objective,daily_budget,lifetime_budget,...` and `insights` with `time_range` (today, last_7d, last_14d, last_30d, last_90d). Paginate with `graphGetAllPages`.
  - **Ad sets:** `GET /{accountId}/adsets` (or per campaign `GET /{campaignId}/adsets`) with `fields=id,name,status,campaign_id,daily_budget,bid_strategy,targeting,...` and `insights`.
  - **Ads:** `GET /{accountId}/ads` or per ad set with `fields=id,name,adset_id,creative{id,thumbnail_url,title,body,...}`, `insights`.
- **Types:** Define `MetaCampaign`, `MetaAdSet`, `MetaAd` (and nested `MetaAdCreative`, `MetaInsights`) matching API responses. Normalize into a shape we store (e.g. flatten insights by date range).
- **Rate limits:** Use existing backoff if needed; respect Meta’s rate headers.

### 6A.2 Sync job and storage

- **Storage schema (option A — one snapshot file):**
  - `data/{brandId}/meta-account-snapshot.json`:
    - `syncedAt`, `accountId`
    - `campaigns: MetaCampaign[]`
    - `adsets: MetaAdSet[]`
    - `ads: MetaAd[]`
    - Optionally `insightsByRange: { last_7d: {...}, last_30d: {...} }` if we want to cache multiple ranges.
- **Storage schema (option B — separate files):** `meta-campaigns.json`, `meta-adsets.json`, `meta-ads.json` each with `syncedAt` and list. Easier to do partial syncs (e.g. only today’s insights) later.
- **API route:** `POST /api/meta-ads/sync` — body: `{ brand, timeRanges?: ["today","last_7d","last_14d"] }`. Fetches campaigns → ad sets → ads (with insights for given ranges), writes to `data/{brandId}/...`. Returns `{ ok, campaignsCount, adsetsCount, adsCount, syncedAt }`.
- **Idempotent:** Full overwrite per run. Optional: store only changed entities by `id` for incremental later.

### 6A.3 Read API for UI

- **Routes:**
  - `GET /api/meta-ads/campaigns?brand=&timeRange=last_7d` — read from snapshot, return campaigns (with aggregated or nested insights).
  - `GET /api/meta-ads/adsets?brand=&campaignId=&timeRange=` — filter ad sets (optionally by campaign).
  - `GET /api/meta-ads/ads?brand=&adsetId=&campaignId=&timeRange=` — filter ads; include creative thumbnail URLs for hover.
  - `GET /api/meta-ads/creatives?brand=&timeRange=last_90d&minSpend=500&sortBy=roas&limit=5` — creatives view (derived from ads + insights).
- All read from `data/{brandId}/...`; if no snapshot, return empty or 404 and prompt “Run sync first”.

---

## Phase 6B: Reports UI (campaigns → ad sets → ads)

**Goal:** Top-level reports page with KPIs, card view (top 5), chart over time, drill-down, filters, and inline edits.

### 6B.1 Navigation and layout

- Add **“Ads Manager”** to main nav (`app/layout.tsx`) linking to e.g. `/ads-manager` (or `/ads-manager/campaigns`).
- **Layout:** `app/ads-manager/layout.tsx` with sub-nav: **Home** (optional dashboard) | Campaigns | Ad sets | Creatives | Workshop | Settings. Brand/account switcher at top (e.g. dropdown). Brand from search param or context (e.g. `?brand=winespies` or from Context Hub brand).
- **Home:** Optional dashboard showing same KPIs and “Last synced” with quick links to Campaigns / Creatives; can default to Campaigns if Home is omitted.

### 6B.2 Campaigns page

- **Data:** `GET /api/meta-ads/campaigns?brand=&timeRange=...`
- **Top:** Big numbers (spend, revenue, ROAS, purchases, CPA, etc.) for selected time range; time range dropdown (Today, 7d, 14d, 30d, 90d).
- **View toggle:** **Chart** | **Cards** tabs. Chart = line/area over time (spend, revenue); Cards = top N (e.g. 5) by selected metric. Card view shows “Showing 5 of N” when a subset is highlighted.
- **Card view:** Top 5 campaigns by selected metric (revenue, ROAS, spend — user pick); show name, key metric, thumbnail from linked ad creative.
- **Chart:** Line/area chart over time; data from insights breakdown by day. Hover: show thumbnail in corner (from top ad in that campaign).
- **Table:** Sortable columns (name, daily budget, status, spend, revenue, ROAS, optional **Score** as composite metric, CPA, purchases, CTR, CPC, CPM, AOV); filter by “name contains” / “name doesn’t contain”.
- **Inline edit:** Daily budget (and lifetime budget if applicable) editable in table; on blur or “Save”, `PATCH` to API that calls Meta `POST /{campaign_id}` with new budget. Same for status (pause/activate) if desired.
- **Click row:** Navigate to `/ads-manager/adsets?campaignId=...`.

### 6B.3 Ad sets page

- **Data:** `GET /api/meta-ads/adsets?brand=&campaignId=&timeRange=...`
- Same structure: KPIs, card view (top 5 ad sets), chart, table with sort/filter.
- **Inline edit:** Daily budget, **bid cap** (for bid-capped ad sets). Push to Meta via `POST /{adset_id}`.
- **Click row:** Navigate to `/ads-manager/ads?adsetId=...` (and pass campaignId for breadcrumb).

### 6B.4 Ads page

- **Data:** `GET /api/meta-ads/ads?brand=&adsetId=&campaignId=&timeRange=...`
- Table with creative thumbnail, name, ad set, campaign, metrics. Hover: larger thumbnail (e.g. bottom-right).
- Filter/sort as above. No inline budget here (budget lives at campaign/ad set); optionally status toggle.

### 6B.5 Creatives view

- **Data:** `GET /api/meta-ads/creatives?brand=&timeRange=last_90d&minSpend=500&sortBy=roas&limit=20`
- **Header:** e.g. “Top creatives” / “Best-performing ads by ROAS” (or selected metric). **Filters:** Date range (e.g. Last 90 days), Min spend (e.g. $500+), Launched/dimension if needed.
- “Top N creatives by ROAS (or revenue, spend) with min spend $X.” Chart | Cards tabs as on Campaigns; card + table; same hover thumbnail. Useful for creative analysis.
- **Last updated:** Show “Updated X min ago” or “Last synced at …” next to Refresh so users know data freshness (see 6B.6).

### 6B.6 Refresh behavior

- **Manual:** “Refresh” button that calls `POST /api/meta-ads/sync` then refetches.
- **Last sync display:** Show “Last synced at …” or “Updated X min ago” next to Refresh on Campaigns, Ad sets, Ads, and Creatives pages (from snapshot `syncedAt`).
- **Auto:** Optional client-side polling every 30 min for “today” only (lightweight sync) or rely on cron for 7d/14d (see Phase 6E).

---

## Phase 6C: Write API (budgets, bid caps)

**Goal:** Apply budget and bid cap changes from the UI to Meta.

- **Token:** Ensure `META_ACCESS_TOKEN` has `ads_management` (and read permissions already used).
- **Routes:**
  - `PATCH /api/meta-ads/campaigns/[id]` — body: `{ daily_budget?, lifetime_budget?, status? }`. Call `graphGet` with method POST to `/{id}` and `daily_budget` etc. Return updated entity or error.
  - `PATCH /api/meta-ads/adsets/[id]` — body: `{ daily_budget?, bid_strategy?, bid_amount?, status? }`. Same idea.
- **Validation:** Check brand’s account owns the entity (campaign/ad set belongs to `act_xxx`). Optional: load from snapshot to verify id exists.
- **UI:** Table cells for budget/bid become editable; on save call PATCH then refresh or update local state.

---

## Phase 6D: Peabot — Q&A over ad data

**Goal:** Chat that answers questions like “What was the top ad creative last week?” using synced campaign/ad set/ad data.

### Option A: Extend existing Chat

- **New “context” or “tool”:** When brand is selected and we have Ads Manager data, inject a tool or system context: “The user can ask about campaigns, ad sets, and ads. Use the following data: …” (summary or full JSON for small accounts). Or add a **tool** that the chat API can call: `query_ads_data({ query, timeRange })` that runs a small in-memory query or calls a dedicated API.
- **API:** `POST /api/chat` already; add optional `tools` or `contextType: 'ads_manager'` that loads `data/{brandId}/meta-account-snapshot.json` and either passes a summary to the system prompt or exposes a server-side function that the model can “call” (e.g. “query ads by name sorted by ROAS”) and get back a small JSON. Model then formats the answer.

### Option B: Dedicated Peabot route and UI

- **Entry points:** (1) **Dedicated page** `/ads-manager/peabot` or side panel. (2) **Report pages:** Peabot icon/chip on Campaigns, Ad sets, and Creatives (e.g. near “Updated X min ago” / Refresh) that opens the same Q&A experience in a drawer or panel so users can ask about the current view without leaving the page.
- **API:** `POST /api/ads-manager/peabot` — body: `{ brand, message, history? }`. Load snapshot for brand; build a system prompt that includes a structured summary of campaigns/adsets/ads (or the full data if small); send to Claude with user message. Stream or return reply. No need for a separate “database” if we pass the snapshot; for very large accounts, we could later add a small query layer (e.g. filter by date, name, sort by metric) and only pass that result to the model.
- **Suggested implementation:** Start with Option B: one route that reads snapshot, summarizes (e.g. “Campaigns: name, id, spend, revenue; Ad sets: …; Ads: …”) and sends to Claude with “Answer the user’s question about this ad account.” Then add optional tool use for “run this filter/sort” so the model can ask for “top 5 ads by ROAS last 7d” and we return a small table.

---

## Phase 6E: AI suggestions (daily / weekly)

**Goal:** Scheduled jobs that scan the account and suggest changes (e.g. raise ROAS floor, scale down unprofitable ad set); user can Apply (push to Meta) or Dismiss.

### 6E.1 Storage

- `data/{brandId}/meta-ads-suggestions.json` — e.g. `{ generatedAt, type: "daily"|"weekly", suggestions: { id, entityType: "campaign"|"adset", action, payload, reason }[] }`. Or store in DB if we want history.

### 6E.2 System prompt and rules

- **Doc or config:** e.g. `docs/ads-manager-suggestion-rules.md` or env-backed: “Look for: ad sets with ROAS &lt; X over last N days → suggest increase ROAS floor or pause; ad sets with strong ROAS and under budget → suggest scale up.” Parameters (e.g. min spend, ROAS floor) can be in brand config or env.
- **Daily job:** Input = snapshot (today + last_7d). Output = 1–5 suggestions (tight changes).
- **Weekly job:** Input = snapshot (last_14d). Output = “bigger swing” suggestions.

### 6E.3 API

- **Generate:** `POST /api/meta-ads/suggestions` — body: `{ brand, type: "daily"|"weekly" }`. Load snapshot, run Claude with suggestion prompt, parse response into structured suggestions, write to `meta-ads-suggestions.json`. Return `{ ok, suggestions }`.
- **List:** `GET /api/meta-ads/suggestions?brand=` — read from file.
- **Apply:** `POST /api/meta-ads/suggestions/apply` — body: `{ brand, suggestionId }`. Find suggestion, call PATCH campaign/ad set with `payload`, then remove or mark suggestion as applied.
- **Dismiss:** `POST /api/meta-ads/suggestions/dismiss` — body: `{ brand, suggestionId }`. Remove or mark dismissed.

### 6E.4 Cron

- **Daily:** e.g. 8am — run sync for brand(s), then `POST /api/meta-ads/suggestions` with `type: daily`.
- **Weekly:** e.g. Sunday night — sync, then `type: weekly`.
- Use same cron secret as in CLAUDE.md (Phase 5.1); pass `brand` (or loop over BRANDS).

### 6E.5 UI

- **Ads Manager dashboard or Campaigns page:** Card or sidebar “Suggestions” — show list with reason, “Apply” and “Dismiss” buttons. On Apply, call apply API and refresh.

---

## Phase 6F: Workshop (ad builder + publish to Facebook)

**Goal:** Full ad composer (headline, primary text, description, CTA, URL, creatives) with AI image gen and optional drag-drop; publish to Facebook (choose campaign/ad set, then push).

### 6F.1 Workshop data model

- **Storage:** e.g. `data/{brandId}/workshop-ads.json` — list of workshop projects: `{ id, name, headline, primary_text, description, cta, url, creatives: { images: [...], videos: [...] }, status: "draft"|"complete", created_at, updated_at }`. Or use DB. Each “workshop” is one draft ad (or a small set of variations). **Status** drives lifecycle (Draft = in progress; Complete = ready to publish or already published).

### 6F.2 Workshop UI

- **List page:** `/ads-manager/workshop` — “Ad Creative Workshop” with “+ New Workshop”; table or cards: project name, thumbnails, date, creatives count, **status** (Draft | Complete), optional summary. Status filter (All / Draft / Complete). Breadcrumb: Home → All Workshops.
- **Detail page:** `/ads-manager/workshop/[id]` — breadcrumb: Home → All Workshops → [Project name]. **Form:** Headline, primary text, description, CTA button (dropdown: Learn More, Shop Now, etc.), URL. Creatives: image/video slots; “Generate with AI” (reuse existing Gemini flow from Ad Builder) and “Upload” (drag-drop). Multiple creatives supported (carousel / multi-image); one selected for preview.
- **Live preview:** Show how the ad will look on Meta (e.g. mobile placement): “Sponsored”, primary text, headline, creative, CTA. Updates as user edits.
- **Peabot in Workshop:** Integrate same AI (e.g. Claude + image API) for **iterative refinement**: user can ask e.g. “Again but keep the text and cover within a 1:1 safe zone” or “Make a 4:5 image with essentials in 1:1”; model generates/updates creatives and can explain (e.g. safe zones, dimensions). “Ask P-Bot about creatives…”-style input; responses can update ad fields and metadata (e.g. ad name convention).
- **Reuse:** Ad Builder’s copy generation and image generation (Gemini) where possible; this is the “full ad” shell that can call the same APIs, then add Meta-specific fields and publish.

### 6F.3 Publish to Facebook

- **Meta API:** Create ad creative (image or video), then create ad linked to creative and ad set. Flow: `POST /act_xxx/ads` with `name`, `adset_id`, `creative={creative_id}`. Creative creation: `POST /act_xxx/adcreatives` with `object_story_spec` (image/video URL, link, caption, etc.). Use Meta’s “flexible” format if we want one creative for multiple placements.
- **API route:** `POST /api/meta-ads/publish` — body: `{ brand, workshopAdId, campaignId, adsetId, options?: { standaloneVsFlexible } }`. Load workshop ad, create creative(s), then create ad(s). Return `{ ok, adId, creativeId }` or error.
- **UI:** “Publish to Facebook” button; modal: select campaign, then ad set (from synced list), then confirm. Call publish API.

### 6F.4 Creative enhancement defaults (Settings)

- **Storage:** `data/{brandId}/meta-ads-creative-defaults.json` — e.g. `{ image: { ... }, video: { ... }, carousel: { ... } }` with all Meta options we care about (placement, etc.). See [Meta ad creative specs](https://developers.facebook.com/docs/marketing-api/guides/lead-ads/create).
- **Settings UI:** `/ads-manager/settings` — form with every option; save to file. When publishing (6F.3), merge these defaults into the creative payload so we don’t have to set them in Facebook each time.

---

## Phase 6G: Polish and resilience

- **Error handling:** Sync and write routes return `{ ok: false, error }`; surface in UI (“Last sync failed”, “Apply failed”).
- **Rate limits:** Meta 429 → retry with backoff; show “Rate limited; try again later” if needed.
- **Auth:** If the app is shared, protect Ads Manager (and cron) with same auth as rest of app (Phase 5.4). Tokens stay server-side.

---

## Suggested order of implementation

| Order | Phase | Delivers |
|-------|--------|----------|
| 1 | **6A** | Sync + storage + read API for campaigns/adsets/ads/creatives |
| 2 | **6B** | Reports UI: campaigns, ad sets, ads, creatives pages with tables, cards, charts, filters, time range |
| 3 | **6C** | Write API + inline edit (budget, bid cap) in UI |
| 4 | **6D** | Peabot: Q&A over ad data (dedicated route + UI in Ads Manager) |
| 5 | **6E** | Suggestions: generate, list, apply, dismiss + cron daily/weekly |
| 6 | **6F** | Workshop: full ad composer + publish to Facebook + creative defaults settings |
| 7 | **6G** | Error handling, rate limits, auth if needed |

---

## Env and permissions

- **Existing:** `META_ACCESS_TOKEN`, `META_AD_ACCOUNT_ID` (or per-brand `metaAdAccountId`).
- **Permissions:** Add `ads_management` for PATCH campaign/ad set and for creating ads/creatives. Keep `ads_read` and `pages_read_engagement` for existing comments flow.
- **Optional:** `CRON_SECRET` for scheduled sync and suggestion jobs (see Phase 5.1).

---

## Docs to add or update

- **This file:** `docs/ads-manager-plan.md` — living plan; update as phases are implemented.
- **CLAUDE.md:** Add a short “Phase 6: Ads Manager” pointer to this doc.
- **`docs/ads-manager-suggestion-rules.md`:** When implementing 6E, document the system prompt and parameters for daily/weekly suggestions.

This plan keeps the same patterns as the rest of Rory (brand-aware APIs, `data/{brandId}/`, Next.js API routes, Claude for generation) and makes the Ads Manager a first-class section that can replace day-to-day use of Facebook Ads Manager and tools like AdNova for reporting and publishing.
