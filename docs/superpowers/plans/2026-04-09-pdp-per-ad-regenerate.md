# PDP Per-Ad Regenerate with Fix Instruction — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a per-ad regenerate button to the PDP generate screen (step 4) that expands an inline fix-instruction textarea, allowing the user to tweak a single ad without re-running the entire batch.

**Architecture:** The fix instruction flows from `ResultsGrid` local state → `onRegenerate(id, fixInstruction)` callback → `useGenerator.regenerate()` → `callGenerate()` → `POST /api/pdp/generate` where it is appended to the existing `customPrompt`. No new API routes or storage.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS 4

---

## File Map

| File | Change |
|------|--------|
| `app/api/pdp/generate/route.ts` | Accept `fixInstruction?: string` in request body; append to `customPrompt` if non-empty |
| `app/creative/pdp/hooks/useGenerator.ts` | Add `fixInstruction?: string` param to `callGenerate()` and `regenerate()` |
| `app/creative/pdp/page.tsx` | Update `handleRegenerate` to accept and forward `fixInstruction` |
| `app/creative/pdp/components/ResultsGrid.tsx` | Add `expandedCards`/`fixInstructions` state; Regenerate button; inline expand panel in `JobCard` |

---

## Task 1: API — Accept and apply fixInstruction

**Files:**
- Modify: `app/api/pdp/generate/route.ts:20-33` (body type), `app/api/pdp/generate/route.ts:77-83` (prompt building)

- [ ] **Step 1: Add `fixInstruction` to the request body type**

In `route.ts`, find the `body` destructuring (lines 20–33). Replace the type cast to add the new optional field:

```typescript
const body = (await req.json()) as {
  brand?: string;
  styleId: string;
  wineData: {
    headline: string;
    score?: string;
    pullQuote?: string;
    salePrice: string;
    retailPrice: string;
    ctaText?: string;
    bottleImageUrl: string;
  };
  fixInstruction?: string;
};
```

- [ ] **Step 2: Append fixInstruction to customPrompt**

After the existing `customPrompt` block (around line 83), add:

```typescript
if (body.fixInstruction?.trim()) {
  customPrompt = (customPrompt ?? "") + `\n\nAdditional fix: ${body.fixInstruction.trim()}`;
}
```

The full customPrompt block should now look like:

```typescript
let customPrompt: string | undefined;
if (refAd.generationPrompt) {
  customPrompt = substitutePromptVariables(refAd.generationPrompt, {
    wineDetails,
    wineName: wineData.headline,
  });
}
if (body.fixInstruction?.trim()) {
  customPrompt = (customPrompt ?? "") + `\n\nAdditional fix: ${body.fixInstruction.trim()}`;
}
```

- [ ] **Step 3: Verify the server compiles**

```bash
npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors in `app/api/pdp/generate/route.ts`.

- [ ] **Step 4: Commit**

```bash
git add app/api/pdp/generate/route.ts
git commit -m "feat(pdp): accept fixInstruction in generate API, append to prompt"
```

---

## Task 2: Hook — Thread fixInstruction through callGenerate and regenerate

**Files:**
- Modify: `app/creative/pdp/hooks/useGenerator.ts:80-95` (callGenerate), `app/creative/pdp/hooks/useGenerator.ts:155-176` (regenerate)

- [ ] **Step 1: Add `fixInstruction` param to `callGenerate`**

Replace the `callGenerate` function signature and body (lines 80–95):

```typescript
async function callGenerate(
  brand: string,
  styleId: string,
  wineData: ReturnType<typeof buildWineData>,
  fixInstruction?: string
): Promise<{ imageBase64: string; mimeType: string }> {
  const res = await fetch("/api/pdp/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ brand, styleId, wineData, fixInstruction }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<{ imageBase64: string; mimeType: string }>;
}
```

- [ ] **Step 2: Add `fixInstruction` param to `regenerate`**

Replace the `regenerate` callback (lines 155–176):

```typescript
const regenerate = useCallback(
  async (
    jobId: string,
    ctx: WineAdContext,
    style: { id: string; name: string },
    overrides: WineOverrides,
    brand = "winespies",
    fixInstruction?: string
  ) => {
    updateJob(jobId, { status: "generating", error: undefined });
    try {
      const wineData = buildWineData(ctx, overrides);
      const data = await callGenerate(brand, style.id, wineData, fixInstruction);
      updateJob(jobId, { status: "complete", imageBase64: data.imageBase64, mimeType: data.mimeType });
    } catch (err) {
      updateJob(jobId, {
        status: "error",
        error: err instanceof Error ? err.message : "Generation failed",
      });
    }
  },
  [updateJob]
);
```

- [ ] **Step 3: Verify types compile**

```bash
npm run build 2>&1 | tail -20
```

Expected: no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add app/creative/pdp/hooks/useGenerator.ts
git commit -m "feat(pdp): thread fixInstruction through callGenerate and regenerate"
```

---

## Task 3: Page — Update handleRegenerate to forward fixInstruction

**Files:**
- Modify: `app/creative/pdp/page.tsx:128-138` (handleRegenerate)

- [ ] **Step 1: Update `handleRegenerate` signature and call**

Replace the `handleRegenerate` callback (lines 128–138):

```typescript
const handleRegenerate = useCallback(
  async (jobId: string, fixInstruction?: string) => {
    const job = generator.jobs.find((j) => j.id === jobId);
    if (!job) return;
    const ctx = feed.selectedContexts.find((c) => c.sale_id === job.saleId);
    const style = styles.find((s) => s.id === job.styleId);
    if (!ctx || !style) return;
    await generator.regenerate(jobId, ctx, style, overrides[job.saleId] ?? {}, "winespies", fixInstruction);
  },
  [generator, feed.selectedContexts, styles, overrides]
);
```

- [ ] **Step 2: Update ResultsGrid prop type in page**

The `onRegenerate` prop on `<ResultsGrid>` is passed as `onRegenerate={handleRegenerate}` — no change needed to the JSX since TypeScript will infer the new signature from step 4 below. But we need to update the `ResultsGridProps` interface first (done in Task 4). For now just verify this file compiles after Task 4.

- [ ] **Step 3: Commit**

```bash
git add app/creative/pdp/page.tsx
git commit -m "feat(pdp): update handleRegenerate to accept and forward fixInstruction"
```

---

## Task 4: UI — Add Regenerate button and inline fix panel to JobCard

**Files:**
- Modify: `app/creative/pdp/components/ResultsGrid.tsx` (full file)

- [ ] **Step 1: Update `ResultsGridProps` interface**

Find the interface (lines 100–107) and update `onRegenerate`:

```typescript
interface ResultsGridProps {
  jobs: GenerationJob[];
  running: boolean;
  progress: { total: number; complete: number; error: number; generating: number };
  onRegenerate: (id: string, fixInstruction?: string) => void;
  onBack: () => void;
  onPublish: () => void;
}
```

- [ ] **Step 2: Add `expandedCards` and `fixInstructions` state to `ResultsGrid`**

Inside `ResultsGrid` (after the `completedJobs` line), add:

```typescript
const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
const [fixInstructions, setFixInstructions] = useState<Record<string, string>>({});

const toggleExpand = (id: string) => {
  setExpandedCards((prev) => {
    const next = new Set(prev);
    if (next.has(id)) {
      next.delete(id);
    } else {
      next.add(id);
    }
    return next;
  });
};
```

Add `useState` to the import at the top of the file:

```typescript
import { useState } from "react";
```

- [ ] **Step 3: Update `JobCard` props to accept new state**

Replace the `JobCard` props interface and function signature:

```typescript
function JobCard({
  job,
  running,
  expanded,
  fixInstruction,
  onToggleExpand,
  onFixInstructionChange,
  onRegenerate,
}: {
  job: GenerationJob;
  running: boolean;
  expanded: boolean;
  fixInstruction: string;
  onToggleExpand: () => void;
  onFixInstructionChange: (value: string) => void;
  onRegenerate: (fixInstruction?: string) => void;
}) {
```

- [ ] **Step 4: Add Regenerate button and inline panel to `JobCard` footer**

Replace the entire `JobCard` return statement with this updated version:

```typescript
  const canRegenerate = !running && (job.status === "complete" || job.status === "error");

  return (
    <div className="border border-border rounded-xl overflow-hidden bg-surface flex flex-col">
      {/* Image area */}
      <div className="aspect-square bg-background relative flex items-center justify-center">
        {job.imageBase64 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`data:${job.mimeType};base64,${job.imageBase64}`}
            alt={`${job.wineName} — ${job.styleName}`}
            className="w-full h-full object-contain"
          />
        ) : job.status === "generating" ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-muted">Generating…</span>
          </div>
        ) : job.status === "error" ? (
          <div className="text-center px-4">
            <div className="text-sm text-danger font-medium mb-1">Generation failed</div>
            <div className="text-xs text-muted">{job.error}</div>
          </div>
        ) : (
          <div className="w-10 h-10 rounded-full border-2 border-border/40" />
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2.5 flex items-center justify-between gap-2 border-t border-border/40">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-foreground truncate">{job.wineName}</div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted truncate">{job.styleName}</span>
            <span className="text-muted/30">·</span>
            <StatusPill status={job.status} error={job.error} />
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {canRegenerate && (
            <button
              onClick={onToggleExpand}
              className="text-[11px] text-accent hover:underline"
            >
              {expanded ? "Cancel" : "Regenerate"}
            </button>
          )}
          {job.imageBase64 && (
            <button
              onClick={() => downloadImage(job)}
              title="Download"
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Inline fix panel */}
      {expanded && (
        <div className="px-3 pb-3 pt-1 border-t border-border/40 flex flex-col gap-2">
          <textarea
            value={fixInstruction}
            onChange={(e) => onFixInstructionChange(e.target.value)}
            placeholder="Describe a fix — e.g. make pricing buttons square, 4px radius"
            rows={2}
            className="w-full text-xs rounded-lg border border-border bg-background px-2.5 py-2 text-foreground placeholder:text-muted resize-none focus:outline-none focus:ring-1 focus:ring-accent"
          />
          <button
            onClick={() => onRegenerate(fixInstruction || undefined)}
            disabled={job.status === "generating"}
            className="self-end px-3 py-1.5 bg-accent text-white text-xs font-medium rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {job.status === "generating" ? "Generating…" : "Regenerate"}
          </button>
        </div>
      )}
    </div>
  );
```

- [ ] **Step 5: Update the `JobCard` usage in `ResultsGrid` to pass new props**

Find the `jobs.map` section (around line 174) and replace it:

```typescript
{jobs.map((job) => (
  <JobCard
    key={job.id}
    job={job}
    running={running}
    expanded={expandedCards.has(job.id)}
    fixInstruction={fixInstructions[job.id] ?? ""}
    onToggleExpand={() => toggleExpand(job.id)}
    onFixInstructionChange={(val) =>
      setFixInstructions((prev) => ({ ...prev, [job.id]: val }))
    }
    onRegenerate={(fixInstruction) => onRegenerate(job.id, fixInstruction)}
  />
))}
```

- [ ] **Step 6: Verify the build passes**

```bash
npm run build 2>&1 | tail -30
```

Expected: clean build with no TypeScript errors across all 4 modified files.

- [ ] **Step 7: Manual smoke test**

1. Run `npm run dev`
2. Navigate to `/creative/pdp`
3. Select 1 wine, 1 style, generate
4. Once complete, confirm a "Regenerate" link appears in the card footer
5. Click "Regenerate" — confirm the inline textarea + button expand below the card
6. Type "make pricing buttons square" in the textarea
7. Click the "Regenerate" button inside the panel — confirm the card shows the spinner, then a new image appears
8. Confirm the textarea text is still there after regeneration
9. Click "Cancel" — confirm the panel collapses

- [ ] **Step 8: Commit**

```bash
git add app/creative/pdp/components/ResultsGrid.tsx
git commit -m "feat(pdp): add per-ad Regenerate button with inline fix-instruction panel"
```
