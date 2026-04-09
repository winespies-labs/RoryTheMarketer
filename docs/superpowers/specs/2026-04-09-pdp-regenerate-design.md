# PDP Ad Builder — Per-Ad Regenerate with Fix Instruction

**Date:** 2026-04-09
**Status:** Approved

## Overview

Add a per-ad regenerate capability to the PDP Ad Builder generate screen (step 4). After the initial batch completes, any individual ad can be regenerated with an optional free-text fix instruction (e.g. "make pricing buttons square, 4px radius"). The fix input appears inline below the card and persists across regenerations for iterative refinement.

## UI

- Each completed `JobCard` gets a small "Regenerate" button in the footer, next to the existing download button (refresh icon or text link)
- Clicking toggles an inline panel below the card footer
- The panel contains:
  - A `<textarea>` with placeholder: `"Describe a fix — e.g. make pricing buttons square, 4px radius"`
  - A "Regenerate" button that triggers re-generation (disabled while `status === "generating"`)
- The card image area already shows a spinner overlay during generation — no change needed there
- The fix panel stays open until manually collapsed
- The Regenerate button only appears on cards with `status === "complete"` or `status === "error"`, and only after the initial batch has finished (`running === false`)

## State

Two new pieces of local state in `ResultsGrid`:

```typescript
const [expandedCards, setExpandedCards] = useState<Set<string>>(new Set());
const [fixInstructions, setFixInstructions] = useState<Record<string, string>>({});
```

- `expandedCards` — tracks which card inline panels are open, keyed by `job.id`
- `fixInstructions` — textarea text per `job.id`; persists after regeneration, cleared only on page navigation

## Data Flow

1. User clicks "Regenerate" on a card → panel expands
2. User types fix instruction → stored in `fixInstructions[job.id]`
3. User clicks "Regenerate" in panel → calls `onRegenerate(job.id, fixInstruction)`
4. `ResultsGrid.onRegenerate(id, fixInstruction)` → `useGenerator.regenerate(jobId, ctx, style, overrides, brand, fixInstruction)`
5. `regenerate()` passes `fixInstruction` to `callGenerate()`
6. `callGenerate()` includes `fixInstruction` in POST body to `/api/pdp/generate`
7. API appends to prompt: `{customPrompt}\n\nAdditional fix: {fixInstruction}` (only if `fixInstruction` is non-empty)
8. Gemini generates new image; job updates to `complete` or `error`

## API Changes

`POST /api/pdp/generate` — add optional field:

```typescript
{
  brand?: string;
  styleId: string;
  wineData: { ... };          // unchanged
  fixInstruction?: string;    // new — appended to customPrompt if present
}
```

Server-side: if `fixInstruction` is a non-empty string, append to the prompt before calling Gemini:
```
{existing customPrompt or ""}\n\nAdditional fix: {fixInstruction}
```

## Edge Cases

- **Empty fix text:** Regenerate still works — re-runs with original prompt only
- **Double-submit:** "Regenerate" button disabled while `status === "generating"`
- **Regeneration fails:** Card shows error state; fix text remains for adjustment and retry
- **Batch still running:** Regenerate button hidden until `running === false`

## Files to Change

| File | Change |
|------|--------|
| `app/creative/pdp/components/ResultsGrid.tsx` | Add `expandedCards` + `fixInstructions` state; render inline panel; update `onRegenerate` signature |
| `app/creative/pdp/hooks/useGenerator.ts` | Add `fixInstruction?: string` param to `regenerate()` and `callGenerate()` |
| `app/api/pdp/generate/route.ts` | Accept `fixInstruction` in request body; append to prompt |
| `app/creative/pdp/page.tsx` | Update `handleRegenerate` to pass `fixInstruction` through |
