# Unified Copy Library — Design Spec
**Date:** 2026-04-09

## Problem

- The `DraftsDrawer` below the editor duplicates the library's role: it lists all writeups (both draft and published), taking up space and fragmenting where copy lives.
- The library only shows `published` writeups, making drafts invisible to anyone not in the editor.
- The library's "Open" button doesn't pass the writeup ID — it navigates to a blank editor.

## Goal

All writeups (draft and published) live in the library. The editor is a focused writing surface — you arrive there from the library (or via "New"), and leave back to the library when done.

---

## Changes

### 1. Library Page (`app/copywriting/library/page.tsx`)

**Fetch all writeups**, not just published:
- Change `GET /api/writeups?brand=winespies&status=published` → `GET /api/writeups?brand=winespies` (no status filter)

**Add status filter tabs**: All · Draft · Published
- Client-side filter — no additional API calls
- Default tab: All

**Update actions per writeup:**
- "Open" button → `router.push('/copywriting/editor?id=${w.id}')` (fix the existing bug)
- "Copy" button — keep as-is (copies content to clipboard)
- Status toggle button:
  - If draft: "Publish" → sets status to "published"
  - If published: "Unpublish" → sets status to "draft"
- "Delete" button — replaces the current "Unpublish"-only action

**Add "New writeup" button** in the page header → `router.push('/copywriting/editor')` (no ID = blank editor)

**Show draft/published badge** on each row (already done in DraftsDrawer, add to library card)

**Update empty states:**
- All tab: "No writeups yet. Start writing."
- Draft tab: "No drafts. Start a new writeup."
- Published tab: "No published writeups yet."

---

### 2. Editor Page (`app/copywriting/editor/page.tsx`)

**Remove `DraftsDrawer`** entirely:
- Remove `drawerOpen` state
- Remove `onToggle`, `onNew`, `onDelete` drawer props
- Remove the `DraftsDrawer` import and render

**Load writeup from URL on mount:**
- Read `?id` from `useSearchParams()` — the editor page is already `"use client"` and uses `useSearchParams`, which requires wrapping the component (or a child) in `<Suspense>`. Wrap the editor page export in a `<Suspense fallback={null}>` boundary.
- If `id` present: fetch `GET /api/writeups/${id}?brand=winespies` on mount and populate `title`, `content`, `activeWriteupId`, `writeupStatus`, `critiqueData` (if score exists)
- If no `id`: editor starts blank (new writeup), same as today

**Add a slim back link** at the top of the editor content area (above the editor/panel split):
```
← Library
```
Links to `/copywriting/library`. No other changes to the editor layout.

**Keep all existing editor behavior:**
- Auto-save every 30s (creates new writeup on first save if no `activeWriteupId`)
- Manual save button
- Research, Review, Publish tabs on the right panel
- After publish, the piece is now accessible via the library's "Published" tab

---

### 3. `DraftsDrawer.tsx` — Delete the file

`app/copywriting/editor/components/DraftsDrawer.tsx` is no longer needed. Remove it.

---

## Data Model — No Changes

The `Writeup` model (`status: "draft" | "published"`) is unchanged. The API is unchanged. Only the UI layer changes.

## Out of Scope

- A third status (e.g. "archived") — not needed now
- Bulk actions in the library
- Sorting options beyond the current default (updatedAt desc)
