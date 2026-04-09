# Markdown Toolbar Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a markdown formatting toolbar to the copywriting editor and fix the Flesch-Kincaid score to ignore markdown syntax characters.

**Architecture:** Four isolated changes in dependency order: (1) new `lib/markdown-utils.ts` with pure utility functions, (2) patch `lib/flesch-kincaid.ts` to strip markdown before scoring, (3) new `MarkdownToolbar` component, (4) wire toolbar and keyboard shortcuts into `EditorPanel`. No new dependencies — raw markdown stays in the textarea, no preview rendering.

**Tech Stack:** React 19, TypeScript strict, Tailwind CSS 4, Next.js App Router.

---

### Task 1: `lib/markdown-utils.ts` — utility functions

**Files:**
- Create: `lib/markdown-utils.ts`

- [ ] **Step 1: Create the file**

Create `lib/markdown-utils.ts` with this exact content:

```typescript
// lib/markdown-utils.ts

export type MarkdownSyntax = "bold" | "italic" | "h1" | "h2" | "h3" | "ul" | "ol";

export interface ApplyResult {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

/**
 * Applies markdown formatting to a textarea's current selection.
 * For inline syntax (bold, italic): wraps selection or inserts placeholder.
 * For block syntax (h1-h3, ul, ol): prefixes each selected line. Toggles off if already present.
 */
export function applyMarkdown(
  textarea: HTMLTextAreaElement,
  syntax: MarkdownSyntax
): ApplyResult {
  const { value, selectionStart, selectionEnd } = textarea;
  const selected = value.slice(selectionStart, selectionEnd);

  // --- Inline: bold / italic ---
  if (syntax === "bold" || syntax === "italic") {
    const marker = syntax === "bold" ? "**" : "*";
    const placeholder = syntax === "bold" ? "bold text" : "italic text";

    if (selected) {
      // Toggle off if already wrapped
      if (
        selected.startsWith(marker) &&
        selected.endsWith(marker) &&
        selected.length > marker.length * 2
      ) {
        const inner = selected.slice(marker.length, -marker.length);
        const newValue =
          value.slice(0, selectionStart) + inner + value.slice(selectionEnd);
        return {
          value: newValue,
          selectionStart,
          selectionEnd: selectionStart + inner.length,
        };
      }
      const wrapped = `${marker}${selected}${marker}`;
      const newValue =
        value.slice(0, selectionStart) + wrapped + value.slice(selectionEnd);
      return {
        value: newValue,
        selectionStart,
        selectionEnd: selectionStart + wrapped.length,
      };
    } else {
      // No selection: insert placeholder, select the placeholder text
      const inserted = `${marker}${placeholder}${marker}`;
      const newValue =
        value.slice(0, selectionStart) + inserted + value.slice(selectionEnd);
      return {
        value: newValue,
        selectionStart: selectionStart + marker.length,
        selectionEnd: selectionStart + marker.length + placeholder.length,
      };
    }
  }

  // --- Block: headings / lists ---
  // Expand selection to cover full lines
  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const lineEndIdx = value.indexOf("\n", selectionEnd);
  const blockEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
  const block = value.slice(lineStart, blockEnd);
  const lines = block.split("\n");

  let newLines: string[];

  if (syntax === "h1" || syntax === "h2" || syntax === "h3") {
    const prefix = syntax === "h1" ? "# " : syntax === "h2" ? "## " : "### ";
    const allHave = lines.every((l) => l.startsWith(prefix));
    newLines = allHave
      ? lines.map((l) => l.slice(prefix.length))
      : lines.map((l) => (l.startsWith(prefix) ? l : prefix + l));
  } else if (syntax === "ul") {
    const allHave = lines.every((l) => l.startsWith("- "));
    newLines = allHave
      ? lines.map((l) => l.slice(2))
      : lines.map((l) => (l.startsWith("- ") ? l : `- ${l}`));
  } else {
    // ol
    const olRegex = /^\d+\. /;
    const allHave = lines.every((l) => olRegex.test(l));
    newLines = allHave
      ? lines.map((l) => l.replace(olRegex, ""))
      : lines.map((l, i) => (olRegex.test(l) ? l : `${i + 1}. ${l}`));
  }

  const newBlock = newLines.join("\n");
  const newValue = value.slice(0, lineStart) + newBlock + value.slice(blockEnd);
  const lengthDiff = newBlock.length - block.length;

  return {
    value: newValue,
    selectionStart: lineStart,
    selectionEnd: blockEnd + lengthDiff,
  };
}

/**
 * Strips markdown syntax characters before Flesch-Kincaid scoring
 * so asterisks and prefixes don't inflate syllable counts.
 */
export function stripMarkdownForFK(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1") // **bold**
    .replace(/\*(.+?)\*/g, "$1")      // *italic*
    .replace(/^#{1,6} /gm, "")        // # headings
    .replace(/^- /gm, "")             // - bullets
    .replace(/^\d+\. /gm, "");        // 1. numbered lists
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors in `lib/markdown-utils.ts` (ignore any pre-existing errors in other files).

- [ ] **Step 3: Commit**

```bash
git add lib/markdown-utils.ts
git commit -m "feat: add markdown-utils — applyMarkdown and stripMarkdownForFK"
```

---

### Task 2: Fix FK score — strip markdown before calculation

**Files:**
- Modify: `lib/flesch-kincaid.ts`

The current `calculateFK` function (lines 54–79) operates on raw text including markdown syntax characters like `**`, `*`, `# `, etc. This inflates syllable counts and skews the grade level. Fix: strip markdown first via `stripMarkdownForFK`.

- [ ] **Step 1: Add import at the top of `lib/flesch-kincaid.ts`**

After the opening comment block (after line 4), add:

```typescript
import { stripMarkdownForFK } from "@/lib/markdown-utils";
```

- [ ] **Step 2: Replace the `calculateFK` function body**

Replace the existing `calculateFK` function (currently lines 54–80) with:

```typescript
export function calculateFK(text: string): FKResult {
  const plain = stripMarkdownForFK(text);
  if (!plain.trim()) {
    return { gradeLevel: 0, words: 0, sentences: 0, syllables: 0 };
  }

  const words = countWords(plain);
  if (words === 0) {
    return { gradeLevel: 0, words: 0, sentences: 0, syllables: 0 };
  }

  const sentences = countSentences(plain);
  const syllables = plain
    .trim()
    .split(/\s+/)
    .filter((w) => w.replace(/[^a-zA-Z0-9]/g, "").length > 0)
    .reduce((sum, word) => sum + countSyllables(word), 0);

  const gradeLevel =
    0.39 * (words / sentences) + 11.8 * (syllables / words) - 15.59;

  return {
    gradeLevel: Math.round(gradeLevel * 10) / 10,
    words,
    sentences,
    syllables,
  };
}
```

The only change from the original: `const plain = stripMarkdownForFK(text);` at the top, and all references to the raw `text` variable replaced with `plain`.

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 4: Commit**

```bash
git add lib/flesch-kincaid.ts
git commit -m "fix: strip markdown syntax before FK grade calculation"
```

---

### Task 3: `MarkdownToolbar` component

**Files:**
- Create: `app/copywriting/editor/components/MarkdownToolbar.tsx`

- [ ] **Step 1: Create the component**

```typescript
// app/copywriting/editor/components/MarkdownToolbar.tsx
"use client";

import { type RefObject } from "react";
import { applyMarkdown, type MarkdownSyntax } from "@/lib/markdown-utils";

interface MarkdownToolbarProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
}

interface ButtonDef {
  label: string;
  syntax: MarkdownSyntax;
  title: string;
  className?: string;
  separatorAfter?: boolean;
}

const BUTTONS: ButtonDef[] = [
  { label: "B", syntax: "bold", title: "Bold (⌘B)", className: "font-bold" },
  { label: "I", syntax: "italic", title: "Italic (⌘I)", className: "italic", separatorAfter: true },
  { label: "H1", syntax: "h1", title: "Heading 1" },
  { label: "H2", syntax: "h2", title: "Heading 2" },
  { label: "H3", syntax: "h3", title: "Heading 3", separatorAfter: true },
  { label: "•", syntax: "ul", title: "Bullet list" },
  { label: "1.", syntax: "ol", title: "Numbered list" },
];

export default function MarkdownToolbar({ textareaRef, onChange }: MarkdownToolbarProps) {
  function handleAction(syntax: MarkdownSyntax) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const result = applyMarkdown(textarea, syntax);
    onChange(result.value);
    // Restore focus and cursor after React re-render
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(result.selectionStart, result.selectionEnd);
    });
  }

  return (
    <div className="flex items-center gap-0.5 px-1.5 py-1 border border-border rounded-lg bg-surface mb-1.5">
      {BUTTONS.map(({ label, syntax, title, className, separatorAfter }) => (
        <span key={syntax} className="contents">
          <button
            type="button"
            title={title}
            onMouseDown={(e) => {
              e.preventDefault(); // Prevent textarea blur before action fires
              handleAction(syntax);
            }}
            className={`px-2 py-0.5 text-xs rounded text-foreground hover:bg-accent/10 hover:text-accent transition-colors ${className ?? ""}`}
          >
            {label}
          </button>
          {separatorAfter && (
            <span className="w-px h-4 bg-border mx-0.5 self-center" />
          )}
        </span>
      ))}
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Commit**

```bash
git add app/copywriting/editor/components/MarkdownToolbar.tsx
git commit -m "feat: add MarkdownToolbar component"
```

---

### Task 4: Wire toolbar and keyboard shortcuts into `EditorPanel`

**Files:**
- Modify: `app/copywriting/editor/components/EditorPanel.tsx`

The current file is 84 lines. It has a plain `<textarea>` with no formatting hooks. We add: two new imports, a `handleKeyDown` function, the `<MarkdownToolbar>` above the textarea, and `onKeyDown` on the textarea.

- [ ] **Step 1: Replace the entire file**

```typescript
// app/copywriting/editor/components/EditorPanel.tsx
"use client";

import { getFKLevel, type FKResult } from "@/lib/flesch-kincaid";
import { applyMarkdown } from "@/lib/markdown-utils";
import MarkdownToolbar from "./MarkdownToolbar";

interface EditorPanelProps {
  title: string;
  onTitleChange: (title: string) => void;
  content: string;
  onContentChange: (content: string) => void;
  fk: FKResult;
  saveStatus: "idle" | "saving" | "saved" | "error";
  onSave: () => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
}

export default function EditorPanel({
  title,
  onTitleChange,
  content,
  onContentChange,
  fk,
  saveStatus,
  onSave,
  textareaRef,
}: EditorPanelProps) {
  const fkLevel = getFKLevel(fk.gradeLevel);
  const fkColor =
    fkLevel === "green"
      ? "text-success bg-green-50 border-success"
      : fkLevel === "yellow"
        ? "text-amber-600 bg-amber-50 border-amber-400"
        : "text-danger bg-red-50 border-danger";

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (!(e.metaKey || e.ctrlKey)) return;
    if (e.key === "b" || e.key === "i") {
      e.preventDefault();
      const textarea = e.currentTarget;
      const result = applyMarkdown(textarea, e.key === "b" ? "bold" : "italic");
      onContentChange(result.value);
      requestAnimationFrame(() => {
        textarea.focus();
        textarea.setSelectionRange(result.selectionStart, result.selectionEnd);
      });
    }
  }

  return (
    <div className="flex flex-col h-full">
      <input
        type="text"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Wine name (e.g. 2021 Duckhorn Napa Valley Merlot)"
        className="w-full px-4 py-3 border border-border rounded-xl bg-surface text-lg font-medium focus:outline-none focus:border-accent transition-colors mb-3"
      />

      {textareaRef && (
        <MarkdownToolbar textareaRef={textareaRef} onChange={onContentChange} />
      )}
      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => onContentChange(e.target.value)}
        onKeyDown={handleKeyDown}
        placeholder="Start writing your wine write-up here..."
        className="flex-1 w-full min-h-[400px] px-4 py-3 border border-border rounded-xl bg-surface text-sm leading-relaxed resize-y focus:outline-none focus:border-accent transition-colors"
      />

      {/* Footer: FK badge + word count + save */}
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-3">
          {fk.words > 0 && (
            <>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${fkColor}`}>
                FK {fk.gradeLevel}
              </span>
              <span className="text-xs text-muted">
                {fk.words} words &middot; {fk.sentences} sentences
              </span>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onSave}
            disabled={!content.trim()}
            className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saveStatus === "saving"
              ? "Saving..."
              : saveStatus === "saved"
                ? "Saved!"
                : saveStatus === "error"
                  ? "Save Failed"
                  : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no new errors.

- [ ] **Step 3: Manual verification**

Run `npm run dev`. Open `/copywriting/editor`. Check each behavior:

1. Toolbar renders above the textarea: `B I | H1 H2 H3 | • 1.`
2. Select "hello" → click **B** → text becomes `**hello**`
3. With `**hello**` selected → click **B** again → text becomes `hello` (toggle)
4. Click **I** with nothing selected → inserts `*italic text*` with "italic text" selected
5. Place cursor anywhere in a line → click **H2** → line prefixed with `## `; click **H2** again → prefix removed
6. Select two lines → click **•** → both lines get `- ` prefix
7. Type `**bold** and *italic* words` in textarea → FK word count shows 4 words (not counting asterisks)
8. ⌘B / Ctrl+B wraps selection in `**...**`
9. ⌘I / Ctrl+I wraps selection in `*...*`

- [ ] **Step 4: Commit**

```bash
git add app/copywriting/editor/components/EditorPanel.tsx
git commit -m "feat: wire MarkdownToolbar and ⌘B/⌘I shortcuts into EditorPanel"
```
