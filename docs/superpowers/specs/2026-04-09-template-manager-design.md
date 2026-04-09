# Template Manager — Design Spec
**Date:** 2026-04-09
**Status:** Approved

---

## Problem

Generation prompts for reference ad templates live in markdown files at `context/Examples/Ads/Static/`. On Railway (Postgres mode) the filesystem doesn't survive redeploys, so there is no way to view or edit a template's prompt through the UI. Adding new templates also requires code changes.

---

## Goal

Make the Style Selector (Step 2 of the PDP Builder at `/creative/pdp`) the central hub for all template management:

1. **View and edit** any template's generation prompt inline
2. **Add new templates** — upload a reference image, name it, write or auto-generate its prompt
3. **Auto-generate prompt** — Claude Vision analyzes the uploaded reference image and produces a Nano Banana 2-style Gemini prompt pre-filled in the textarea

---

## What Already Exists (do not rebuild)

- `app/api/ad-reference/detail/` — GET `?id=` returns `generationPrompt`
- `app/api/ad-reference/update/` — PUT accepts `{ id, generationPrompt }` (JSON or multipart), persists to Postgres
- `app/api/ad-reference/create/` — POST multipart (image file + data JSON), persists to Postgres
- `app/creative/pdp/components/StyleSelector.tsx` — existing card grid to extend
- `app/creative/pdp/hooks/useStyles.ts` — fetches styles from `/api/pdp/styles`

---

## What Gets Built

### 1. Inline Prompt Editor on Each Template Card

Each `StyleCard` gets an "Edit prompt" button below the template name.

**Behaviour:**
- Only one card can be in edit state at a time
- Clicking "Edit prompt" on a card fetches the full prompt from `GET /api/ad-reference/detail?id={id}` and expands a panel directly below the card spanning the full grid row
- The panel contains:
  - Label: "Generation Prompt — {template name}"
  - `<textarea>` pre-filled with the current prompt (monospace, resizable, ~8 rows)
  - "Save prompt" button → `PUT /api/ad-reference/update` with `{ id, generationPrompt }`
  - "Discard" link → collapses without saving
  - On save: brief "Saved ✓" inline confirmation, then collapse after 1.5s
- Selecting/deselecting a card is independent of the edit state — a selected card can have its editor open simultaneously

**State managed in StyleSelector:**
```typescript
const [editingId, setEditingId] = useState<string | null>(null);
const [promptDrafts, setPromptDraft] = useState<Record<string, string>>({});
const [promptSaving, setPromptSaving] = useState<Record<string, boolean>>({});
const [promptSaved, setPromptSaved] = useState<Record<string, boolean>>({});
```

### 2. "Add Template" Card

A dashed placeholder card always rendered last in the grid.

**Clicking it expands a form below the grid** containing:
- **Image upload** (drag-and-drop or click) — accepts PNG/JPG, shows a preview thumbnail once selected
- **Template name** — text input (required)
- **Generation prompt** — `<textarea>` (required), with an "✨ Auto-generate from image" button beside the label
- **"Create Template"** button → `POST /api/ad-reference/create` (multipart: image file + `data` JSON field containing `{ label, brand: "winespies", generationPrompt }`)
- **"Cancel"** link → collapses the form, clears state
- On success: the new template appears in the grid immediately (refresh styles list); form collapses

### 3. Auto-Generate Prompt (new API route)

**New route:** `POST /api/ad-reference/generate-prompt`

**Request:**
```
multipart/form-data
  image: File   (the reference style image)
```

**Behaviour:**
- Reads the uploaded image
- Sends it to Claude (`claude-sonnet-4-6`) with a vision prompt instructing it to analyze the ad layout and produce a Nano Banana 2-style Gemini image-generation prompt with `{{token}}` placeholders for dynamic fields (`{{wineName}}`, `{{score}}`, `{{salePrice}}`, `{{retailPrice}}`, `{{pullQuote}}`, `{{ctaText}}`)
- Returns `{ prompt: string }`

**UI:**
- "✨ Auto-generate from image" button is disabled until an image is uploaded
- While generating: button shows "Generating…" and is disabled
- On success: textarea is pre-filled with the returned prompt (user can still edit before saving)
- On error: inline error message below textarea

### 4. StyleSelector layout change

The grid needs to support the "expand below" pattern for both the editor panel and the add form. Because CSS grid rows are implicit, the expanded panels are rendered as separate full-width rows after the card they belong to rather than as grid children — achieved by breaking out of the grid when a panel is open.

Simplest implementation: render the card grid and expanded panels in a column flex container, inserting the expanded panel as a full-width `<div>` after the row containing the active card. This avoids complex CSS grid row manipulation.

---

## Data Flow

```
Edit prompt:
  click "Edit prompt"
    → GET /api/ad-reference/detail?id={id}  → { generationPrompt }
    → textarea pre-filled
  click "Save prompt"
    → PUT /api/ad-reference/update  { id, generationPrompt }
    → "Saved ✓" flash → collapse

Add template:
  upload image → preview shown
  fill name + prompt (or auto-generate)
  click "Create Template"
    → POST /api/ad-reference/create  (multipart)
    → success → refresh useStyles() → new card appears

Auto-generate prompt:
  click "✨ Auto-generate from image"
    → POST /api/ad-reference/generate-prompt  (multipart, image)
    → Claude Vision → structured Gemini prompt with {{tokens}}
    → pre-fill textarea
```

---

## Files Changed

| File | Change |
|------|--------|
| `app/creative/pdp/components/StyleSelector.tsx` | Add edit-prompt inline panel + add-template card + form |
| `app/api/ad-reference/generate-prompt/route.ts` | New — Claude Vision → Gemini prompt generation |

Everything else (create, update, detail API routes, Prisma model) already exists and is unchanged.

---

## Key Invariants

1. **Only one edit panel open at a time** — opening a second collapses the first without saving
2. **Auto-generate requires image to be selected first** — button is disabled otherwise
3. **Create requires both image AND name AND prompt** — "Create Template" button disabled until all three are present
4. **Save writes to Postgres** — survives Railway redeploys
5. **New template appears immediately** — `useStyles` re-fetches after successful create
6. **Selection is independent of edit state** — a selected card can have its editor open

---

## Out of Scope

- Deleting templates (no delete button — avoided to prevent accidental loss)
- Editing the reference style image of an existing template
- Template reordering
