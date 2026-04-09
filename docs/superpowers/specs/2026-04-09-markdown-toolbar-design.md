# Copywriting Editor — Markdown Toolbar

**Date:** 2026-04-09
**Status:** Approved

## Overview

Add a markdown formatting toolbar to the copywriting editor pane. The toolbar provides one-click formatting for bold, italic, headings, and lists, plus keyboard shortcuts for the most common actions. Markdown stays raw in the textarea — no preview or rendering. Also fixes the Flesch-Kincaid grade score, which currently overcounts syllables because it reads raw markdown syntax characters.

---

## Components

### `lib/markdown-utils.ts` (new)

Two exported functions used by the toolbar and FK fix:

**`applyMarkdown(textarea, syntax)`**

Applies markdown formatting to a `<textarea>` element by reading its current selection state and returning updated text + new cursor position. Never mutates the DOM directly — the caller applies the result.

`syntax` is one of:
- `"bold"` → wraps with `**`
- `"italic"` → wraps with `*`
- `"h1"` / `"h2"` / `"h3"` → prefixes each selected line with `# ` / `## ` / `### ` (toggles off if already present)
- `"ul"` → prefixes each selected line with `- ` (toggles off if already present)
- `"ol"` → prefixes each selected line with `1. `, `2. `, etc. (toggles off if already present)

Behavior:
- If text is selected → wraps or prefixes the selection
- If nothing is selected (inline syntax: bold/italic) → inserts placeholder text surrounded by syntax, e.g. `**bold text**`, cursor ends up selecting the placeholder
- If nothing is selected (block syntax: headings/lists) → applies to the current line
- Toggle: if the selected text already has the syntax, remove it instead of double-applying

**`stripMarkdownForFK(text)`**

Returns plain text suitable for Flesch-Kincaid calculation by removing:
- Bold/italic markers: `**`, `*`, `__`, `_`
- Heading prefixes: `/^#{1,6} /gm`
- Unordered list prefixes: `/^- /gm`
- Ordered list prefixes: `/^\d+\. /gm`

---

### `app/copywriting/editor/components/MarkdownToolbar.tsx` (new)

A controlled presentational component — no internal state.

**Props:**
```typescript
interface MarkdownToolbarProps {
  textareaRef: RefObject<HTMLTextAreaElement>;
  onChange: (value: string) => void;
}
```

Renders a row of icon/text buttons: **B** · *I* · H1 · H2 · H3 · `•` (bullet list) · `1.` (numbered list)

Each button calls `applyMarkdown(textarea, syntax)`, then:
1. Sets the textarea value via `onChange`
2. Restores focus to the textarea
3. Restores the cursor/selection to the post-insertion position

Styled with Tailwind — matches existing editor UI (small buttons, border-bottom toolbar pattern). No external icon library.

---

### `app/copywriting/editor/components/EditorPanel.tsx` (modify)

Two changes:

1. **Add toolbar**: Render `<MarkdownToolbar>` above the `<textarea>`, passing a `textareaRef` and the existing `onChange` handler.

2. **Add keyboard shortcuts**: `onKeyDown` listener on the textarea:
   - `Cmd+B` (Mac) / `Ctrl+B` (Win) → `applyMarkdown(textarea, "bold")`
   - `Cmd+I` / `Ctrl+I` → `applyMarkdown(textarea, "italic")`

---

### `lib/flesch-kincaid.ts` (modify)

Pipe input through `stripMarkdownForFK()` before the syllable-counting logic. No other changes to the FK algorithm.

---

## Data Flow

```
User types in textarea
  ↓
EditorPanel state holds raw markdown string
  ↓
MarkdownToolbar reads textarea DOM for selection → calls applyMarkdown()
EditorPanel.onChange receives updated markdown string → state update
  ↓
textarea re-renders with new value; cursor position restored
  ↓
FK score re-calculated on stripped text (no markdown syntax noise)
```

---

## Out of Scope

- Markdown preview / rendered output
- Link insertion (`[text](url)` syntax)
- Image insertion
- Table support
- Any new npm dependencies
- Changes to other editor panels (title, hook, etc.)
