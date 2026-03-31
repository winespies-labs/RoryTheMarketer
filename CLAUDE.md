# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## What This Is

Rory the Marketer — a full-stack marketing operations hub for **Wine Spies** (wine e-commerce). Centralizes brand context, copywriting tools, ad creation, Meta Ads management, competitor research, and AI-powered analysis. Built for a single user (CMO at Wine Spies).

## Commands

```bash
npm run dev          # Start dev server
npm run build        # prisma generate && next build
npm run start        # prisma migrate deploy && next start
npm run lint         # ESLint
npm run db:generate  # prisma generate
npm run db:migrate   # prisma migrate deploy
npm run db:studio    # Prisma Studio (interactive DB UI)
```

No test suite exists.

## Tech Stack

- **Next.js 16** (App Router, no `src/` directory), **React 19**, **TypeScript strict**
- **Tailwind CSS 4** with CSS variables in `app/globals.css` — light theme, no component library
- **PostgreSQL via Prisma 6** (optional — falls back to JSON file storage if `DATABASE_URL` unset)
- **AI:** Anthropic SDK (`claude-sonnet-4-5`), Google Gemini, FAL AI, OpenAI Whisper
- **APIs:** Meta Graph/Marketing, Foreplay, Apify, Slack
- **Charts:** Recharts

## Architecture

### File Layout

- `app/` — Pages and API routes (Next.js App Router)
- `lib/` — Shared server utilities
- `context/` — Brand context markdown files (voice, personas, USPs) — read at runtime, not bundled
- `data/{brandId}/` — Per-brand synced/generated JSON data
- `templates/{id}/` — Ad templates (`schema.json` + `template.html` with `{{token}}` placeholders)
- `knowledge/` — Competitor intel, swipe files
- `docs/` — Implementation specs (see `app-overview.md` for full API endpoint list)

### Multi-Brand System

Brand config lives in `lib/brands.ts`. All API routes accept a `brand` query param validated via `getBrand()`. Currently one active brand: `winespies`.

- Context paths: `context/` (default) or `context/brands/{brandId}/`
- Data paths: `data/{brandId}/`

### Dual Storage

- `lib/database.ts` exports `useDatabase()` — returns `true` if `DATABASE_URL` is set
- **Prisma path:** Snapshots, swipes, insights, writeups (see `prisma/schema.prisma` for 8 models)
- **JSON file path:** Reviews, comments, themes, chats stored in `data/{brandId}/`
- Storage abstraction in `lib/context-library-storage.ts` handles CRUD for both modes

### Context Bundle Pattern

`lib/context-bundle.ts` → `getContextBundle(brandId)` reads all brand markdown files into a single JSON object. This bundle is injected into Claude system prompts across all AI routes. The pattern is: context bundle → system prompt, user input → user prompt, structured JSON output.

### Assembler System

Wine data → template variables → filled HTML → Puppeteer screenshot. Templates in `templates/{id}/` with `schema.json` (slot definitions + `max_chars`) and `template.html`. Token resolution via `lib/prompt-variables.ts`.

### API Route Conventions

- All routes return JSON via `NextResponse.json()`
- Long-running AI routes set `export const maxDuration = 60`
- Claude calls use `@anthropic-ai/sdk` — server-side only
- No authentication on any routes

## Key Patterns

- **Brand-aware routes:** Most accept `?brand=winespies`; validate with `getBrand()` from `lib/brands.ts`
- **Context injection:** Every AI route calls `getContextBundle()` and injects it into the system prompt
- **Reference ad templates:** Use `{{token}}` placeholders (e.g., `{{wineName}}`, `{{copy.headline}}`). After copy generation, image prompts can use `{{copy.*}}` tokens. Unresolved tokens left as-is. Implementation: `lib/prompt-variables.ts`
- **fs operations, API keys, Claude calls** — server-side only, never in client components
- **CSS variables:** `--accent` (purple), `--muted`, `--border`, `--surface`, `--success`, `--danger` defined in `app/globals.css`

## Environment Variables

**Required:** `ANTHROPIC_API_KEY`

**Recommended:** `DATABASE_URL` (PostgreSQL), `META_ACCESS_TOKEN`

**Feature-specific:** `META_AD_ACCOUNT_ID`, `META_PAGE_ID`, `GOOGLE_AI_API_KEY`, `FAL_KEY`, `OPENAI_API_KEY`, `APIFY_API_TOKEN`, `SLACK_BOT_TOKEN`, `SLACK_REVIEWS_CHANNEL_ID`, `FOREPLAY_API_KEY`, `CRON_SECRET`

## App Sections

| Route | Purpose |
|-------|---------|
| `/context-hub` | Brand DNA — voice, personas, USPs, assets, reviews, comment themes |
| `/copywriting/*` | Editor, library, drills (7 techniques × 14 exercises), swipe analyzer |
| `/copywriter` | Wine-specific copy generation |
| `/ad-builder` | Multi-step ad wizard (6 ad types, 4 aspect ratios, Gemini/FAL image gen) |
| `/briefs` | Creative brief generation (video, email, social, general) |
| `/wines` | Wine ad pipeline → copy + image → publish to Meta |
| `/ads-manager/*` | Meta campaigns, ad sets, creatives, workshop, settings, daily insights |
| `/swipes` | Swipe file library and inspiration |
| `/chat` | AI chat assistant with full brand context |
| `/instagram-research` | Instagram scraping via Apify |
