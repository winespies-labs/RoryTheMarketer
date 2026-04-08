# Rory The Marketer — App Overview

## What It Is

A full-stack marketing operations hub built for **Wine Spies** (wine e-commerce). It centralizes brand context, copywriting tools, ad creation, competitor research, Meta Ads management, and AI-powered analysis into one Next.js app. Think of it as a marketing team's operating system — brand voice, copy generation, ad publishing, and performance reporting all in one place.

## Tech Stack

- **Framework:** Next.js 16 (App Router, API Routes)
- **Language:** TypeScript (strict)
- **Database:** PostgreSQL via Prisma (optional — falls back to JSON files)
- **Styling:** Tailwind CSS 4
- **AI:** Claude Sonnet 4.5 (copy, analysis, themes), Google Gemini (image gen), FAL AI (image gen/editing), OpenAI Whisper (transcription)
- **APIs:** Meta Graph/Marketing API, Foreplay, Apify (Instagram), Slack, Notion
- **Charts:** Recharts

## Architecture

### Multi-Brand System
All paths are resolved through brand config in `lib/brands.ts`:
- **Context** (markdown): `context/` (default brand) or `context/brands/{brandId}/`
- **Data** (JSON): `data/{brandId}/`
- **Every API route** accepts a `brand` param

Currently one brand configured: **Wine Spies** (`winespies`). A second (`archival`) has a placeholder directory.

### Storage Pattern
Two tiers:
1. **File-based** — Markdown for brand context (voice, personas, USPs), JSON for synced data (reviews, comments, campaigns, themes)
2. **PostgreSQL** — Structured data: swipe library entries, Meta campaign/ad set/ad snapshots, daily insights, writeups, sync logs

### Context Bundle
`GET /api/context/bundle?brand=` reads all brand markdown files and returns a single JSON object (voice, personas, USPs, wine copy guidance, review themes, comment themes). This bundle is injected into Claude system prompts across all AI routes.

---

## App Sections & Current Functionality

### 1. Context Hub (`/context-hub`)
Brand DNA dashboard — view and manage:
- Voice guidelines, personas (4 operative subtypes), USPs
- Wine copy guidance, A/B test learnings
- Brand assets (upload logos, images)
- Reviews (uploaded CSV, Slack sync, Trustpilot)
- Meta ad comment themes

### 2. Copywriting (`/copywriting`, `/copywriter`)
- **Copy Editor** (`/copywriting/editor`) — Freeform copy generation with brand context + persona selection + swipe file injection
- **Copy Drill** (`/copywriting/drill`) — 7 technique categories x 14 exercises (price anchoring, urgency, flavor copy, etc.)
- **Swipe Analyzer** (`/copywriting/swipe-analyzer`) — Analyze competitor copy techniques
- **Copywriter** (`/copywriter`) — Standalone copy generation with wine write-up support (headline, score, prices, tasting notes, promo code)

### 3. Creative & Ad Builder (`/ad-builder`, `/briefs`, `/wines`)
- **Ad Builder** (`/ad-builder`) — Multi-step wizard: configure ad type (PDP, testimonial, comparison, offer, UGC, lifestyle) → pick aspect ratio → select brand assets/reference ads → generate copy + image via Gemini/FAL
- **Briefs** (`/briefs`) — Generate video/email/social/general creative briefs with persona targeting
- **Wine Ads** (`/wines`) — Wine-specific ad generation: enter wine details → generate copy + image → publish directly to Meta
- **Swipes** (`/swipes`) — Browse and manage swipe file library

### 4. Ads Manager (`/ads-manager`)
In-app Meta Ads reporting and management:
- **Campaigns** — List with KPIs (spend, impressions, clicks, ROAS), status badges, time range selector
- **Ad Sets** (`/ads-manager/ad-sets`) — Drill into ad sets with budget/bid info
- **Creatives** (`/ads-manager/creatives`) — View ad creatives with preview
- **Workshop** (`/ads-manager/workshop`) — Build ads with chat-assisted creative
- **Settings** (`/ads-manager/settings`) — Account configuration
- **Sync from Meta** — Pull campaigns, ad sets, ads, and daily insights
- **Inline edits** — Update campaign budgets/status, push changes back to Meta

### 5. Chat (`/chat`)
Conversational assistant with full brand context. Chat history persisted per brand. Sidebar with past conversations.

### 6. Instagram Research (`/instagram-research`)
Scrape Instagram via Apify — search by keyword, transcribe video content, analyze competitor posts.

---

## All API Routes (57 endpoints)

### Brand & Context
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/brands` | List all brands |
| GET | `/api/context/bundle` | Full context bundle for a brand |
| GET | `/api/context/status` | Context completeness check |
| GET | `/api/context/section` | Single context section |
| GET | `/api/context/image-prompt-modifier` | Image prompt modifiers |

### Brand Assets
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/brand-assets` | List brand assets |
| POST | `/api/brand-assets/upload` | Upload asset |
| GET | `/api/brand-assets/image` | Retrieve asset image |

### Copywriting & Briefs
| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/copywriter` | Generate copy variations |
| POST | `/api/critique` | AI copy critique (line-by-line redlines, rubric scoring, rewrite) |
| POST | `/api/brief/generate` | Generate creative brief |
| POST | `/api/drill-journal` | Log copywriting drill session |

### Ad Builder & Generation
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/ad-builder/images` | Available images |
| GET | `/api/ad-builder/styles` | Design styles |
| POST | `/api/ad-builder/copy` | Generate ad copy |
| POST | `/api/ad-builder/generate` | Generate full ad |
| POST | `/api/ad-builder/generate-fal` | Generate via FAL AI |
| GET | `/api/ad-builder/generations` | Past generations |

### Reference Ads
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/ad-reference/list` | List reference ads |
| GET | `/api/ad-reference/detail` | Reference ad detail |
| GET | `/api/ad-reference/image` | Reference ad image |
| POST | `/api/ad-reference/create` | Create reference ad |
| POST | `/api/ad-reference/generate` | AI-generate reference ads |
| POST | `/api/ad-reference/generate-statics` | Generate static variants |
| POST | `/api/ad-reference/update` | Update reference ad |
| POST | `/api/ad-reference/delete` | Delete reference ad |
| POST | `/api/ad-reference/build-prompt` | Build generation prompt |

**Reference template variables:** In reference ad markdown (Ad Description, Visual Layout, YAML fields like `nanoBanana`, and `promptOverrides` strings), you can use `{{token}}` placeholders. Values come from the request’s wine fields (`headline`, `score`, `pullQuote`, `retailPrice`, `salePrice`, `promoCode`, `ctaText`, `additionalNotes`, etc.), plus `{{wineName}}`, `{{destinationUrl}}` / `{{saleUrl}}` when `saleId` + brand resolve. After copy generation, Gemini/FAL prompts can use `{{copy.headline}}`, `{{copy.primaryText}}`, `{{copy.description}}`. Unresolved tokens are left as-is. Implementation: `lib/prompt-variables.ts`.

### Wine-Specific
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/wines/current` | Current wine in workflow |
| POST | `/api/wines/generate-single` | Generate wine ad (copy + image) |
| POST | `/api/wines/publish-to-meta` | Publish wine ad to Facebook |

### Reviews (Phase 2)
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/reviews` | List/search reviews (`q`, `topic`, `starred`, `limit`, `offset`) |
| GET | `/api/reviews/config` | UI hints: whether `SLACK_REVIEWS_CHANNEL_ID` is set server-side |
| PATCH | `/api/reviews/[id]` | Star or set `topics[]` for a review |
| POST | `/api/reviews/upload` | Upload reviews CSV |
| POST | `/api/reviews/sync-slack` | Sync from Slack channel |
| GET | `/api/cron/reviews-sync` | Scheduled HTTP: Slack → reviews JSON (`Authorization: Bearer CRON_SECRET`; `SLACK_*` on server) |
| POST | `/api/review-themes` | Generate AI themes from reviews |

### Meta Ads Manager (Phase 6)
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/meta-ads/campaigns` | List campaigns |
| GET | `/api/meta-ads/adsets` | List ad sets |
| GET | `/api/meta-ads/adsets-live` | Live ad sets |
| GET | `/api/meta-ads/ads` | List ads |
| GET | `/api/meta-ads/insights-daily` | Daily performance data |
| GET | `/api/meta-ads/insights-history` | Historical insights |
| POST | `/api/meta-ads/sync` | Full sync from Meta |
| POST | `/api/meta-ads/update-campaign` | Update budget/status |

### Meta Comments (Phase 3)
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/meta-comments` | Stored ad comments |
| POST | `/api/meta-comments/sync` | Fetch from Meta Graph API |
| POST | `/api/meta-comment-themes` | Generate AI themes |

### Competitor Ads (Phase 4)
| Method | Route | Purpose |
|--------|-------|---------|
| GET | `/api/ads-library/search` | Search Meta Ad Library |
| GET | `/api/ads-library/results` | Stored results |
| GET | `/api/foreplay/ads` | Stored Foreplay ads |
| POST | `/api/foreplay/sync` | Sync from Foreplay |
| POST | `/api/analyze-competitor` | AI analysis of competitor ad |

### Swipe Files & Inspiration
| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/swipe-files/import` | Import swipe markdown |
| GET | `/api/swipe-analysis/swipes` | Swipes for analysis |
| GET | `/api/swipe-analysis/corpus` | Analysis corpus |
| POST | `/api/swipe-analysis/run` | Run swipe analysis |
| GET | `/api/swipe-inspiration` | Get inspiration items |
| POST | `/api/swipe-inspiration/upload` | Upload inspiration |
| GET | `/api/swipe-inspiration/image` | Inspiration image |
| POST | `/api/swipe-inspiration/add-to-context` | Add to brand context |
| GET/POST | `/api/context-library` | Context library CRUD |

### Chat, Research, Workshop, Writeups
| Method | Route | Purpose |
|--------|-------|---------|
| POST | `/api/chat` | Send chat message |
| GET | `/api/chat/history` | Chat history |
| GET | `/api/instagram-research/searches` | Past IG searches |
| POST | `/api/instagram-research/search` | Search Instagram |
| POST | `/api/instagram-research/transcribe` | Transcribe IG video |
| POST | `/api/workshop/chat` | Workshop chat |
| POST | `/api/workshop/generate-image` | Workshop image gen |
| POST | `/api/workshop/publish` | Publish from workshop |
| GET/POST | `/api/writeups` | List/create writeups |
| GET/DELETE | `/api/writeups/[id]` | Get/delete writeup |
| POST | `/api/writeups/research` | Generate research writeup |

---

## Claude API Integration

All AI routes use `@anthropic-ai/sdk` with `claude-sonnet-4-5`:

| Route | Purpose | Max Tokens |
|-------|---------|-----------|
| `/api/copywriter` | Copy generation (freeform + wine write-ups) | 2000 |
| `/api/wines/generate-single` | Wine ad copy + image prompt construction | 2000 |
| `/api/critique` | Line-by-line redlines, rubric scoring, rewrite | 2000 |
| `/api/review-themes` | Summarize Trustpilot review themes | 1200 |
| `/api/meta-comment-themes` | Summarize ad comment themes | 1200 |
| `/api/analyze-competitor` | Vision-based competitor ad breakdown | 2000 |
| `/api/brief/generate` | Creative brief generation | 2000 |

Pattern: brand context bundle → system prompt, user input/data → user prompt, structured output.

---

## Environment Variables

### Required
| Var | Purpose |
|-----|---------|
| `ANTHROPIC_API_KEY` | Claude API (all AI routes) |
| `META_ACCESS_TOKEN` | Meta Graph + Marketing + Ad Library API |

### Per-Feature
| Var | Purpose | Phase |
|-----|---------|-------|
| `META_AD_ACCOUNT_ID` | Default Meta ad account | 6 |
| `META_PAGE_ID` | Default Meta page for publishing | 6 |
| `DATABASE_URL` | PostgreSQL (swipes, snapshots, insights) | — |
| `TRUSTPILOT_API_KEY` | Trustpilot review sync | 2 |
| `FOREPLAY_API_KEY` | Foreplay competitor ads | 4 |
| `CRON_SECRET` | Protect scheduled sync routes | 5 |
| `SLACK_BOT_TOKEN` | Slack review sync | — |
| `SLACK_REVIEWS_CHANNEL_ID` | Slack channel ID | — |
| `GOOGLE_AI_API_KEY` | Gemini image generation | — |
| `FAL_KEY` | FAL AI image gen/editing | — |
| `OPENAI_API_KEY` | Whisper transcription | — |
| `APIFY_API_TOKEN` | Instagram scraping | — |

---

## What's Built vs. What's Not

### Fully Built
- Context Hub with brand voice, personas, USPs, brand assets
- Multi-brand architecture (paths, config, API params)
- Copywriter with persona/swipe injection, wine write-ups
- Copy Drill (7 categories x 14 exercises)
- Copy Critique (3-stage AI flow)
- Ad Builder wizard (6 ad types, 4 aspect ratios, Gemini + FAL image gen)
- Reference ads library (create, generate, manage)
- Wine-specific ad pipeline (details → copy + image → publish to Meta)
- Brief generator (video, email, social, general)
- Ads Manager with campaign/ad set/ad reports, insights, sync from Meta
- Meta comment fetching and AI theme generation
- Competitor ad analysis (vision-based)
- Foreplay integration + Meta Ad Library search
- Chat assistant with brand context
- Instagram research via Apify
- Swipe file library + inspiration center
- Writeups system
- Review upload (CSV) and Slack sync (`/reviews` page; stored in Postgres when `DATABASE_URL` is set, else `data/{brand}/reviews.json`)

### Partially Built / Needs Work
- **Trustpilot API sync** — Route and types exist but actual Trustpilot API client (`lib/trustpilot.ts`) may not be fully implemented; reviews currently come from CSV upload and Slack sync
- **Scheduled syncs (Phase 5)** — Reviews: in-process daily job via `instrumentation.ts` + `lib/reviews-slack-cron.ts` when using `next start` with Slack env vars; optional `GET /api/cron/reviews-sync` for external triggers; other syncs (Meta, etc.) are still manual unless you add jobs
- **Brief injection of themes** — Review themes and comment themes are generated and stored, but the brief routes may not yet have `includeReviewThemes`/`includeCommentThemes` toggles wired into the UI
- **Second brand (`archival`)** — Placeholder directory exists but no voice/personas/USPs files

### Not Built
- **Scheduled syncs for non-review data** — Meta Ads sync and similar are not wired to in-app or HTTP cron in-repo
- **Peabot (Phase 6D)** — Q&A chat over synced ad data (planned in ads-manager-plan.md)
- **AI Suggestions (Phase 6E)** — Daily/weekly AI-generated optimization suggestions with Apply/Dismiss
- **Auth/access control (Phase 5.4)** — No authentication; all routes are open
- **Foreplay asset downloading** — Thumbnails/snapshots not saved to disk
- **"Attach to brief" UI** — Checkbox/dropdown to include reviews, comments, or competitor ads when generating briefs

---

## Areas for Improvement

### Architecture
- **No auth** — Anyone with the URL can access everything, trigger syncs, publish ads. At minimum, protect sync/publish routes with API key or session auth.
- **File-based storage fragility** — JSON files in `data/` can corrupt on concurrent writes. The Prisma/PostgreSQL path is partially adopted (snapshots, swipes) but reviews, comments, themes, and chats still use JSON. Migrating fully to Postgres would improve reliability.
- **No error boundary or global error handling** — API routes have try/catch but no centralized error reporting (Sentry, etc.)
- **No rate limit protection on AI routes** — A user could spam `/api/copywriter` and burn through API credits. Consider request throttling.

### AI / Prompts
- **Single model** — Everything uses `claude-sonnet-4-5`. Some routes (theme summaries, simple classification) could use Haiku for cost/speed; complex analysis could benefit from Opus.
- **No prompt versioning** — Prompts are inline in route handlers. Moving to a prompt template system would make iteration easier and enable A/B testing prompts.
- **No streaming** — All Claude calls are blocking. Streaming responses would improve UX for copy generation and chat.
- **Context window management** — The full context bundle is injected every time. For large brands with extensive context, this could hit token limits. Consider selective context injection based on task type.

### Data & Sync
- **No incremental sync** — All sync routes do full overwrites. For Meta campaigns with thousands of ads, incremental sync by date/ID would be more efficient.
- **No sync status UI** — No way to see when the last sync ran, if it failed, or trigger a retry from the UI (partially addressed in Context Hub but not for all sync types).
- **No webhook support** — Relies on polling/manual sync. Meta has webhook support for real-time updates.

### UX
- **No mobile responsiveness assessment** — Built with Tailwind but unclear if layouts work on mobile/tablet.
- **No loading states or optimistic updates** — API calls to Claude can take 5-10 seconds; UI feedback during generation could be improved.
- **Fragmented navigation** — `/copywriting`, `/copywriter`, `/swipes` are separate top-level routes that could be consolidated.
- **No undo/versioning for generated content** — Once copy is generated, previous versions aren't saved for comparison.

### DevOps
- **No tests** — No test files found anywhere in the codebase.
- **No CI/CD pipeline** — No GitHub Actions, no lint-on-push, no deploy preview.
- **Large lib files** — `reference-ads.ts` (14.6K lines), `copy-drill-data.ts` (19.7K lines), `swipe-inspiration-storage.ts` (9.3K lines) are unwieldy. Could be split into smaller modules.
