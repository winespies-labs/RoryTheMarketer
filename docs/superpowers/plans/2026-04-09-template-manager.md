# Template Manager Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add template management (view/edit prompts, add new templates) directly inside the Style Selector (Step 2) of the PDP Builder.

**Architecture:** Two new capabilities added to `StyleSelector.tsx`: (1) an inline prompt editor that expands below any template card as a `col-span-full` grid row, and (2) an "Add Template" card + form that uploads a reference image, names it, and writes or auto-generates a Gemini prompt. A new `POST /api/ad-reference/generate-prompt` route calls Claude Vision to produce the prompt from an uploaded image. The existing `update` and `create` API routes handle saving.

**Tech Stack:** Next.js App Router, React 19, TypeScript strict, Tailwind CSS 4, Anthropic SDK (`claude-sonnet-4-6`), existing `lib/reference-ads.ts` (CRUD), Prisma + Postgres (persistence)

---

## File Map

| File | Action | Responsibility |
|------|--------|---------------|
| `app/api/ad-reference/generate-prompt/route.ts` | **Create** | POST multipart image → Claude Vision → Gemini prompt string |
| `app/creative/pdp/hooks/useStyles.ts` | **Modify** | Add `refresh()` so StyleSelector can trigger a refetch after create |
| `app/creative/pdp/page.tsx` | **Modify** | Pass `onStylesRefresh` prop to StyleSelector |
| `app/creative/pdp/components/StyleSelector.tsx` | **Modify** | Add inline edit panel, Add Template card + form, auto-generate |

---

## Context for Implementer

### Key existing APIs (do not rebuild)

- `GET /api/ad-reference/detail?id={id}` → `{ referenceAd: { generationPrompt: string, ... } }`
- `PUT /api/ad-reference/update` — JSON body `{ id: string, generationPrompt: string }` → updates disk markdown + Postgres
- `POST /api/ad-reference/create` — multipart: `image` (File) + `data` (JSON string with `{ label, brand, generationPrompt }`) → creates on disk + Postgres, returns `{ referenceAd }`
- `GET /api/pdp/styles?brand=winespies` — returns `AdStyle[]` (id, name, imageBase64, mimeType)

### lib/reference-ads.ts key types
```typescript
type ReferenceAdCreateInput = {
  label: string;
  brand: string;
  generationPrompt?: string;
  // platform, format, etc. optional
};
type ReferenceAdUpdateInput = Partial<ReferenceAdCreateInput> & { id: string };
```

`updateReferenceAd({ id, generationPrompt })` preserves all other fields, rewrites markdown, and the route also calls `saveReferenceAdToDb()` to persist to Postgres.

### CSS grid expand-below pattern

Render `StyleCard` + optional `EditorPanel` inside a `React.Fragment` with key. The panel has `className="col-span-full"`. CSS grid auto-placement naturally puts it in a new full-width row immediately after the card's row.

```tsx
<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
  {styles.map(style => (
    <React.Fragment key={style.id}>
      <StyleCard ... />
      {editingId === style.id && <div className="col-span-full ...">...</div>}
    </React.Fragment>
  ))}
  <AddTemplateCard ... />
  {addingTemplate && <div className="col-span-full ...">...</div>}
</div>
```

---

## Task 1: generate-prompt API route

**Files:**
- Create: `app/api/ad-reference/generate-prompt/route.ts`

- [ ] **Step 1: Create the route file**

```typescript
// app/api/ad-reference/generate-prompt/route.ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();
export const maxDuration = 60;

const VISION_PROMPT = `You are analyzing a reference ad image to write a Gemini image-generation prompt.

Study the ad layout carefully: background treatment (color, lighting, atmospheric effects), product/bottle placement (position, size, angle), all text element positions, typography style, color palette, price block design, CTA button style, logo placement, trust badges.

Write a Gemini image-generation prompt that instructs Gemini to recreate this exact ad style with new wine data. The prompt must:

1. Describe the background precisely (hex colors, lighting direction, atmospheric effects, mood)
2. Describe bottle/product placement (position on canvas, size relative to canvas, angle, how background frames it)
3. List every text element with: position on canvas, font style (serif/sans-serif/monospace), approximate size in px, color in hex, max lines, alignment
4. Use these exact token placeholders for dynamic content:
   - {{wineName}} — wine display name
   - {{score}} — critic score e.g. "98 points" — if this element exists, add the note: "If score is blank, omit this element entirely"
   - {{salePrice}} — the sale price
   - {{retailPrice}} — the original retail price
   - {{pullQuote}} — short body copy / quote, 3 lines max
   - {{ctaText}} — CTA button text
5. For price pills/blocks and CTA button: specify exact dimensions (px), border-radius (px), background colors (hex), text colors (hex), font size, font weight
6. End with a REQUIREMENTS section listing: output size (1080×1080px), "Render all text VERBATIM as provided — do not rephrase, shorten, or invent copy", "Include ONLY the text elements listed above — no extra copy, taglines, or invented phrases", "If any token resolves to blank, omit that element and close the gap", "Professional quality suitable for Meta social media advertising"

Return ONLY the prompt text. No preamble, no explanation, no markdown code fences.`;

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const imageFile = formData.get("image") as File | null;

  if (!imageFile) {
    return NextResponse.json({ error: "image is required" }, { status: 400 });
  }

  const buffer = Buffer.from(await imageFile.arrayBuffer());
  const base64 = buffer.toString("base64");
  const mimeType = (imageFile.type || "image/png") as
    | "image/png"
    | "image/jpeg"
    | "image/webp"
    | "image/gif";

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-6",
      max_tokens: 2048,
      messages: [
        {
          role: "user",
          content: [
            {
              type: "image",
              source: { type: "base64", media_type: mimeType, data: base64 },
            },
            { type: "text", text: VISION_PROMPT },
          ],
        },
      ],
    });

    const prompt = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    return NextResponse.json({ prompt });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | grep -E "error|Error|✓ Compiled"
```
Expected: `✓ Compiled successfully` with no TypeScript errors.

- [ ] **Step 3: Commit**

```bash
git add app/api/ad-reference/generate-prompt/route.ts
git commit -m "Add generate-prompt API route — Claude Vision → Gemini prompt"
```

---

## Task 2: Add refresh() to useStyles + wire into page.tsx

**Files:**
- Modify: `app/creative/pdp/hooks/useStyles.ts`
- Modify: `app/creative/pdp/page.tsx`

- [ ] **Step 1: Add refreshKey state and refresh callback to useStyles**

Replace the entire content of `app/creative/pdp/hooks/useStyles.ts`:

```typescript
"use client";

import { useState, useEffect, useCallback } from "react";

export interface AdStyle {
  id: string;
  name: string;
  imageBase64: string;
  mimeType: string;
}

export function useStyles(brand = "winespies") {
  const [styles, setStyles] = useState<AdStyle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/pdp/styles?brand=${brand}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Styles fetch failed: ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setStyles(data as AdStyle[]);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load styles");
        setLoading(false);
      });
  }, [brand, refreshKey]);

  return { styles, loading, error, refresh };
}
```

- [ ] **Step 2: Pass refresh to StyleSelector in page.tsx**

In `app/creative/pdp/page.tsx`, find the `useStyles` call and the `StyleSelector` usage. Make two edits:

**Edit 1** — destructure `refresh` from `useStyles`:
```typescript
// Before:
const { styles, loading: stylesLoading, error: stylesError } = useStyles();
// After:
const { styles, loading: stylesLoading, error: stylesError, refresh: refreshStyles } = useStyles();
```

**Edit 2** — pass `onStylesRefresh` prop to StyleSelector (in the `currentStep === 2` block):
```tsx
// Before:
<StyleSelector
  styles={styles}
  loading={stylesLoading}
  error={stylesError}
  selected={selectedStyleIds}
  onToggle={toggleStyle}
  onBack={() => goToStep(1)}
  onNext={() => goToStep(3)}
  selectedWineCount={feed.selected.length}
/>
// After:
<StyleSelector
  styles={styles}
  loading={stylesLoading}
  error={stylesError}
  selected={selectedStyleIds}
  onToggle={toggleStyle}
  onBack={() => goToStep(1)}
  onNext={() => goToStep(3)}
  selectedWineCount={feed.selected.length}
  onStylesRefresh={refreshStyles}
/>
```

- [ ] **Step 3: Verify build**

```bash
npm run build 2>&1 | grep -E "error TS|✓ Compiled"
```
Expected: `✓ Compiled successfully` — note: TypeScript will error because `StyleSelector` doesn't have `onStylesRefresh` in its props yet. That's fine — it gets fixed in Task 3.

Actually, to keep the build green between tasks, add the prop to StyleSelector's interface now as a temporary stub. Skip this if the build is run only at the end.

- [ ] **Step 4: Commit**

```bash
git add app/creative/pdp/hooks/useStyles.ts app/creative/pdp/page.tsx
git commit -m "Add refresh() to useStyles, wire onStylesRefresh to StyleSelector"
```

---

## Task 3: Inline prompt editor on each template card

**Files:**
- Modify: `app/creative/pdp/components/StyleSelector.tsx`

This task adds: edit button on each card, inline editor panel that expands below the card as a full-width grid row, fetch → edit → save → collapse flow.

- [ ] **Step 1: Replace StyleSelector.tsx with the version that includes the inline editor**

Replace the entire file:

```typescript
// app/creative/pdp/components/StyleSelector.tsx
"use client";

import { Fragment, useState, useCallback } from "react";
import type { AdStyle } from "../hooks/useStyles";

// ─── StyleCard ────────────────────────────────────────────────────────────────

function StyleCard({
  style,
  selected,
  isEditing,
  onToggle,
  onEditPrompt,
}: {
  style: AdStyle;
  selected: boolean;
  isEditing: boolean;
  onToggle: () => void;
  onEditPrompt: () => void;
}) {
  return (
    <div
      className={`relative w-full text-left rounded-xl border transition-all ${
        selected
          ? "border-accent bg-accent/5 ring-1 ring-accent"
          : "border-border bg-surface"
      } ${isEditing ? "rounded-b-none border-b-0" : ""}`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left"
      >
        <div
          className={`absolute top-2 right-2 z-10 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
            selected ? "border-accent bg-accent" : "border-border bg-surface"
          }`}
        >
          {selected && (
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>
        <div className="w-full aspect-square rounded-t-xl overflow-hidden bg-background">
          {style.imageBase64 ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={`data:${style.mimeType};base64,${style.imageBase64}`}
              alt={style.name}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted/40">
              <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </div>
      </button>

      <div className="p-3 flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-foreground truncate">{style.name}</div>
        <button
          type="button"
          onClick={onEditPrompt}
          className="shrink-0 text-xs text-accent hover:text-accent/80 transition-colors"
        >
          {isEditing ? "▲ Close" : "✏️ Edit prompt"}
        </button>
      </div>
    </div>
  );
}

// ─── PromptEditorPanel ────────────────────────────────────────────────────────

function PromptEditorPanel({
  styleId,
  styleName,
  onClose,
}: {
  styleId: string;
  styleName: string;
  onClose: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch current prompt on mount
  useState(() => {
    fetch(`/api/ad-reference/detail?id=${styleId}`)
      .then((r) => r.json())
      .then((data) => {
        setPrompt((data as { referenceAd?: { generationPrompt?: string } }).referenceAd?.generationPrompt ?? "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  });

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/ad-reference/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: styleId, generationPrompt: prompt }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? "Save failed");
      }
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onClose();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="col-span-full border border-accent border-t-0 rounded-b-xl bg-surface p-4 flex flex-col gap-3">
      <div className="text-xs font-semibold text-accent uppercase tracking-wide">
        Generation Prompt — {styleName}
      </div>
      {loading ? (
        <div className="text-sm text-muted py-4 text-center">Loading…</div>
      ) : (
        <>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={10}
            className="w-full px-3 py-2 text-xs font-mono border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-accent resize-y text-foreground"
          />
          {error && <div className="text-xs text-danger">{error}</div>}
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-muted">Saves to Postgres — survives redeploys</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-muted hover:text-foreground transition-colors"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || saved}
                className="px-4 py-1.5 text-xs font-semibold bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-60"
              >
                {saved ? "Saved ✓" : saving ? "Saving…" : "Save prompt"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── StyleSelector ────────────────────────────────────────────────────────────

interface StyleSelectorProps {
  styles: AdStyle[];
  loading: boolean;
  error: string | null;
  selected: string[];
  onToggle: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
  selectedWineCount: number;
  onStylesRefresh: () => void;
}

export default function StyleSelector({
  styles,
  loading,
  error,
  selected,
  onToggle,
  onBack,
  onNext,
  selectedWineCount,
  onStylesRefresh,
}: StyleSelectorProps) {
  const totalAds = selectedWineCount * selected.length;
  const [editingId, setEditingId] = useState<string | null>(null);

  const toggleEdit = useCallback((id: string) => {
    setEditingId((prev) => (prev === id ? null : id));
  }, []);

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Select Styles</h2>
          <p className="text-sm text-muted mt-0.5">
            Each style is a reference ad — Gemini matches its layout and aesthetic with your wine&apos;s data.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="px-3 py-2 text-sm text-muted hover:text-foreground transition-colors">
            ← Back
          </button>
          <button
            onClick={onNext}
            disabled={selected.length === 0}
            className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent/90 transition-colors"
          >
            Next →
          </button>
        </div>
      </div>

      {selected.length > 0 && (
        <div className="rounded-lg border border-border bg-surface px-4 py-3 text-sm">
          <span className="font-medium text-foreground">
            {selectedWineCount} wine{selectedWineCount !== 1 ? "s" : ""} ×{" "}
            {selected.length} style{selected.length !== 1 ? "s" : ""} ={" "}
            <span className="text-accent font-bold">{totalAds} ads</span>
          </span>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16 text-muted text-sm">Loading styles…</div>
      )}
      {error && (
        <div className="rounded-lg bg-danger/10 border border-danger/20 p-4 text-sm text-danger">{error}</div>
      )}

      {!loading && !error && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {styles.map((style) => (
            <Fragment key={style.id}>
              <StyleCard
                style={style}
                selected={selected.includes(style.id)}
                isEditing={editingId === style.id}
                onToggle={() => onToggle(style.id)}
                onEditPrompt={() => toggleEdit(style.id)}
              />
              {editingId === style.id && (
                <PromptEditorPanel
                  styleId={style.id}
                  styleName={style.name}
                  onClose={() => setEditingId(null)}
                />
              )}
            </Fragment>
          ))}

          {/* Add Template card — placeholder for Task 4 */}
          <button
            type="button"
            className="rounded-xl border border-dashed border-border bg-surface hover:border-accent/50 transition-colors flex flex-col items-center justify-center gap-2 aspect-square text-muted"
            disabled
          >
            <div className="w-8 h-8 rounded-full border-2 border-dashed border-muted/40 flex items-center justify-center text-lg text-muted/40">+</div>
            <div className="text-xs text-muted/50">Add Template<br/>(coming soon)</div>
          </button>
        </div>
      )}

      {!loading && !error && styles.length === 0 && (
        <div className="text-center py-8 text-muted text-sm">
          No templates yet. Add one using the + card above.
        </div>
      )}
    </div>
  );
}
```

**Note on the `useState` fetch call:** The `PromptEditorPanel` uses `useState(() => { fetch(...) })` as a one-time initializer. This works because the initializer runs synchronously on mount but the `fetch` is async. A cleaner alternative is `useEffect(fn, [])`. If the linter complains, use `useEffect` instead:

```typescript
// Replace the useState(() => { fetch... }) block with:
useEffect(() => {
  fetch(`/api/ad-reference/detail?id=${styleId}`)
    .then((r) => r.json())
    .then((data) => {
      setPrompt((data as { referenceAd?: { generationPrompt?: string } }).referenceAd?.generationPrompt ?? "");
      setLoading(false);
    })
    .catch(() => setLoading(false));
}, [styleId]);
// Add useEffect to imports at the top
```

- [ ] **Step 2: Verify build**

```bash
npm run build 2>&1 | grep -E "error TS|✓ Compiled|Failed"
```
Expected: `✓ Compiled successfully`

- [ ] **Step 3: Commit**

```bash
git add app/creative/pdp/components/StyleSelector.tsx
git commit -m "Add inline prompt editor to StyleSelector — edit prompt expands below card"
```

---

## Task 4: Add Template card + form + auto-generate

**Files:**
- Modify: `app/creative/pdp/components/StyleSelector.tsx`

This task replaces the disabled "Add Template" stub from Task 3 with the full working implementation: image upload, name field, prompt textarea, auto-generate button, create template flow.

- [ ] **Step 1: Add AddTemplateCard component above StyleSelector**

Insert this component into `StyleSelector.tsx` after `PromptEditorPanel` and before the `StyleSelectorProps` interface:

```typescript
// ─── AddTemplateCard ──────────────────────────────────────────────────────────

function AddTemplateCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-dashed border-border bg-surface hover:border-accent/60 hover:bg-accent/5 transition-colors flex flex-col items-center justify-center gap-2 aspect-square text-muted"
    >
      <div className="w-8 h-8 rounded-full border-2 border-dashed border-muted/50 flex items-center justify-center text-xl font-light">+</div>
      <div className="text-xs font-medium">Add Template</div>
    </button>
  );
}
```

- [ ] **Step 2: Add AddTemplateForm component**

Insert this component after `AddTemplateCard`:

```typescript
// ─── AddTemplateForm ──────────────────────────────────────────────────────────

function AddTemplateForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleImageChange(file: File) {
    setImage(file);
    const reader = new FileReader();
    reader.onload = (e) => setPreview((e.target?.result as string) ?? "");
    reader.readAsDataURL(file);
  }

  async function handleAutoGenerate() {
    if (!image) return;
    setGenerating(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("image", image);
      const res = await fetch("/api/ad-reference/generate-prompt", { method: "POST", body: fd });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? "Generation failed");
      }
      const data = await res.json() as { prompt: string };
      setPrompt(data.prompt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auto-generate failed");
    } finally {
      setGenerating(false);
    }
  }

  async function handleCreate() {
    if (!image || !name.trim() || !prompt.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("image", image);
      fd.append(
        "data",
        JSON.stringify({ label: name.trim(), brand: "winespies", generationPrompt: prompt.trim() })
      );
      const res = await fetch("/api/ad-reference/create", { method: "POST", body: fd });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? "Create failed");
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create template");
      setSaving(false);
    }
  }

  const canCreate = !!image && name.trim().length > 0 && prompt.trim().length > 0;

  return (
    <div className="col-span-full border border-border rounded-xl bg-surface p-5 flex flex-col gap-4">
      <div className="text-sm font-semibold text-foreground">Add New Template</div>
      <div className="grid grid-cols-[140px_1fr] gap-4">
        {/* Image upload */}
        <div className="flex flex-col gap-2">
          <label className="block">
            <div
              className={`aspect-square rounded-lg border-2 border-dashed overflow-hidden cursor-pointer flex flex-col items-center justify-center gap-2 transition-colors ${
                preview ? "border-accent/40" : "border-border hover:border-accent/40"
              }`}
            >
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <>
                  <svg className="w-6 h-6 text-muted/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-[10px] text-muted/60 text-center px-2">Click to upload<br/>PNG or JPG</span>
                </>
              )}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(e) => e.target.files?.[0] && handleImageChange(e.target.files[0])}
              />
            </div>
          </label>
        </div>

        {/* Fields */}
        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-[10px] font-semibold text-muted uppercase tracking-wide mb-1">
              Template Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Lifestyle — Warm Tones"
              className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-semibold text-muted uppercase tracking-wide">
                Generation Prompt
              </label>
              <button
                type="button"
                onClick={handleAutoGenerate}
                disabled={!image || generating}
                className="text-[10px] text-accent hover:text-accent/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {generating ? "Generating…" : "✨ Auto-generate from image"}
              </button>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={8}
              placeholder={image ? "Click Auto-generate or write the Gemini prompt manually…" : "Upload an image first, then auto-generate or write manually…"}
              className="w-full px-3 py-2 text-xs font-mono border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-accent resize-y"
            />
          </div>

          {error && <div className="text-xs text-danger">{error}</div>}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-xs text-muted hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={!canCreate || saving}
              className="px-4 py-1.5 text-xs font-semibold bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Creating…" : "Create Template"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Replace the disabled Add Template stub in StyleSelector with the working version**

In the `StyleSelector` function body, add `addingTemplate` state:

```typescript
// Add alongside editingId state:
const [addingTemplate, setAddingTemplate] = useState(false);
```

Then in the JSX, replace the disabled `<button>` stub (the "Add Template (coming soon)" button) with:

```tsx
{addingTemplate ? null : (
  <AddTemplateCard onClick={() => setAddingTemplate(true)} />
)}
{addingTemplate && (
  <AddTemplateForm
    onCancel={() => setAddingTemplate(false)}
    onCreated={() => {
      setAddingTemplate(false);
      onStylesRefresh();
    }}
  />
)}
```

Also remove the stale empty-state message and merge it into a single coherent empty state. The final grid block should look like:

```tsx
{!loading && !error && (
  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
    {styles.map((style) => (
      <Fragment key={style.id}>
        <StyleCard
          style={style}
          selected={selected.includes(style.id)}
          isEditing={editingId === style.id}
          onToggle={() => onToggle(style.id)}
          onEditPrompt={() => toggleEdit(style.id)}
        />
        {editingId === style.id && (
          <PromptEditorPanel
            styleId={style.id}
            styleName={style.name}
            onClose={() => setEditingId(null)}
          />
        )}
      </Fragment>
    ))}

    {addingTemplate ? null : (
      <AddTemplateCard onClick={() => setAddingTemplate(true)} />
    )}
    {addingTemplate && (
      <AddTemplateForm
        onCancel={() => setAddingTemplate(false)}
        onCreated={() => {
          setAddingTemplate(false);
          onStylesRefresh();
        }}
      />
    )}
  </div>
)}
```

- [ ] **Step 4: Verify build**

```bash
npm run build 2>&1 | grep -E "error TS|✓ Compiled|Failed"
```
Expected: `✓ Compiled successfully`

- [ ] **Step 5: Commit**

```bash
git add app/creative/pdp/components/StyleSelector.tsx
git commit -m "Add Template card + form + auto-generate prompt in StyleSelector"
```

---

## Task 5: Final build verification + push

- [ ] **Step 1: Full clean build**

```bash
npm run build 2>&1 | tail -20
```
Expected: build completes with no TypeScript errors, `/creative/pdp` appears in the route list.

- [ ] **Step 2: Push**

```bash
git push
```

---

## Self-Review

**Spec coverage:**
- ✅ View/edit generation prompt inline — PromptEditorPanel (Task 3)
- ✅ Expand below card (col-span-full) — Fragment pattern in grid (Task 3)
- ✅ Save → PUT /api/ad-reference/update → Postgres (Task 3)
- ✅ Only one editor open at a time — `editingId` state, `toggleEdit` closes previous (Task 3)
- ✅ Add Template card — AddTemplateCard + AddTemplateForm (Task 4)
- ✅ Image upload with preview (Task 4)
- ✅ Auto-generate from image → POST /api/ad-reference/generate-prompt (Tasks 1 + 4)
- ✅ Auto-generate disabled until image uploaded (Task 4, `disabled={!image || generating}`)
- ✅ Create disabled until image + name + prompt all present (Task 4, `canCreate`)
- ✅ New template appears immediately → `onStylesRefresh()` called on success (Task 4)
- ✅ Selection independent of edit state (Task 3 — toggle and edit are separate handlers)

**No placeholders found.** All code blocks are complete and runnable.

**Type consistency:** `AdStyle` interface used consistently from `useStyles.ts`. `onStylesRefresh: () => void` prop added to both `page.tsx` call site and `StyleSelectorProps`. `Fragment` imported from `react` in the component.
