# Unified Copy Library Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Move all writeups (drafts + published) into the library page, and strip the editor down to a focused writing surface with no bottom drawer.

**Architecture:** Library fetches all writeups and filters client-side by status tab. Editor loses its `DraftsDrawer` and `writeups` state entirely — it loads a specific piece via `?id` URL param on mount. Navigation between library and editor is via URL.

**Tech Stack:** Next.js 16 App Router, React 19, TypeScript strict, Tailwind CSS 4. No test suite — verify visually with `npm run dev`.

---

## File Map

| Action | File | What changes |
|--------|------|-------------|
| Modify | `app/copywriting/library/page.tsx` | Fetch all writeups; add status tabs; fix Open button; add Delete; add New button; add status badge |
| Modify | `app/copywriting/editor/page.tsx` | Remove DraftsDrawer; load writeup from `?id`; add back link; wrap in Suspense |
| Delete | `app/copywriting/editor/components/DraftsDrawer.tsx` | No longer used |

---

## Task 1: Rewrite Library Page

**Files:**
- Modify: `app/copywriting/library/page.tsx`

- [ ] **Step 1: Replace the full library page**

Replace the entire contents of `app/copywriting/library/page.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter } from "next/navigation";
import ScoreRing from "../editor/components/ScoreRing";

interface Writeup {
  id: string;
  title: string;
  content: string;
  status: "draft" | "published";
  score: number | null;
  createdAt: string;
  updatedAt: string;
}

type StatusFilter = "all" | "draft" | "published";

const BRAND = "winespies";

export default function LibraryPage() {
  const router = useRouter();
  const [writeups, setWriteups] = useState<Writeup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");

  const loadWriteups = useCallback(async () => {
    try {
      const res = await fetch(`/api/writeups?brand=${BRAND}`);
      if (res.ok) setWriteups(await res.json());
    } catch { /* silently handle */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadWriteups(); }, [loadWriteups]);

  const filtered = writeups.filter((w) => {
    const matchesSearch = w.title.toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === "all" || w.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const handleSetStatus = async (id: string, newStatus: "draft" | "published") => {
    await fetch(`/api/writeups/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brand: BRAND, status: newStatus }),
    });
    await loadWriteups();
  };

  const handleDelete = async (id: string) => {
    await fetch(`/api/writeups/${id}?brand=${BRAND}`, { method: "DELETE" });
    await loadWriteups();
  };

  const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

  const STATUS_TABS: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "All" },
    { key: "draft", label: "Draft" },
    { key: "published", label: "Published" },
  ];

  const emptyMessage =
    statusFilter === "draft" ? "No drafts yet. Start a new writeup." :
    statusFilter === "published" ? "No published writeups yet." :
    search ? "No writeups match your search." :
    "No writeups yet. Start writing.";

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
          <p className="text-sm text-muted mt-1">All your copy in one place.</p>
        </div>
        <button
          onClick={() => router.push("/copywriting/editor")}
          className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
        >
          + New writeup
        </button>
      </div>

      {/* Search + status tabs */}
      <div className="flex items-center gap-4 mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title..."
          className="w-full max-w-xs px-4 py-2 text-sm border border-border rounded-lg bg-surface focus:outline-none focus:border-accent transition-colors"
        />
        <div className="flex items-center gap-1 border border-border rounded-lg p-0.5 bg-surface">
          {STATUS_TABS.map((tab) => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-3 py-1.5 text-xs font-medium rounded-md transition-colors ${
                statusFilter === tab.key
                  ? "bg-accent text-white"
                  : "text-muted hover:text-foreground"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="flex items-center gap-2 text-sm text-muted">
            <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            Loading...
          </div>
        </div>
      ) : filtered.length === 0 ? (
        <div className="text-center py-12">
          <p className="text-muted">{emptyMessage}</p>
        </div>
      ) : (
        <div className="space-y-3">
          {filtered.map((w) => (
            <div
              key={w.id}
              className="flex items-center gap-4 p-4 rounded-xl border border-border bg-surface hover:border-accent/50 transition-colors"
            >
              {/* Score ring */}
              <div className="shrink-0">
                {w.score !== null ? (
                  <ScoreRing score={w.score} size={48} strokeWidth={4} />
                ) : (
                  <div className="w-12 h-12 rounded-full border-2 border-border flex items-center justify-center text-xs text-muted">--</div>
                )}
              </div>

              {/* Info */}
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-semibold truncate">{w.title}</h3>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium shrink-0 ${
                    w.status === "published"
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}>
                    {w.status}
                  </span>
                </div>
                <div className="flex items-center gap-3 text-xs text-muted mt-1">
                  <span>{new Date(w.updatedAt).toLocaleDateString()}</span>
                  <span>{wordCount(w.content)} words</span>
                </div>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2 shrink-0">
                <button
                  onClick={() => navigator.clipboard.writeText(w.content)}
                  className="px-3 py-1.5 text-xs border border-border rounded-lg hover:border-accent transition-colors"
                >
                  Copy
                </button>
                <button
                  onClick={() => router.push(`/copywriting/editor?id=${w.id}`)}
                  className="px-3 py-1.5 text-xs bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
                >
                  Open
                </button>
                <button
                  onClick={() => handleSetStatus(w.id, w.status === "published" ? "draft" : "published")}
                  className="px-3 py-1.5 text-xs text-muted hover:text-foreground border border-border rounded-lg hover:border-accent transition-colors"
                >
                  {w.status === "published" ? "Unpublish" : "Publish"}
                </button>
                <button
                  onClick={() => handleDelete(w.id)}
                  className="px-3 py-1.5 text-xs text-muted hover:text-danger transition-colors"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Verify in browser**

Run `npm run dev` and navigate to `http://localhost:3000/copywriting/library`. Check:
- All writeups show (not just published)
- Status tabs filter correctly
- Status badge (draft/published) shows on each row
- "Open" button navigates to `/copywriting/editor?id=<id>` (check the URL in browser)
- "Publish"/"Unpublish" toggle works
- "Delete" removes the item
- "New writeup" navigates to `/copywriting/editor` (blank)

- [ ] **Step 3: Commit**

```bash
git add app/copywriting/library/page.tsx
git commit -m "feat: unify copy library to show all writeups with status filter tabs"
```

---

## Task 2: Update Editor — Load from URL, Remove Drawer

**Files:**
- Modify: `app/copywriting/editor/page.tsx`

- [ ] **Step 1: Replace the full editor page**

Replace the entire contents of `app/copywriting/editor/page.tsx`:

```tsx
"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { calculateFK, getFKLevel, type FKResult } from "@/lib/flesch-kincaid";
import EditorPanel from "./components/EditorPanel";
import ResearchPanel from "./components/ResearchPanel";
import ReviewPanel, { type CritiqueData } from "./components/ReviewPanel";
import PublishPanel from "./components/PublishPanel";
import ScoreRing from "./components/ScoreRing";
import type { CardStatus } from "./components/CritiqueCard";

interface Writeup {
  id: string;
  title: string;
  content: string;
  status: "draft" | "published";
  score: number | null;
  createdAt: string;
  updatedAt: string;
}

interface WineDetails {
  wineName: string;
  varietal: string;
  region: string;
  points: string;
  priceDiscount: string;
  tastingNotes: string;
  scarcityAngle: string;
}

const BRAND = "winespies";
const AUTO_SAVE_INTERVAL = 30000;
const TABS = ["Research", "Review", "Publish"] as const;
type Tab = (typeof TABS)[number];

function EditorPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const writeupId = searchParams.get("id");

  // Editor state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [fk, setFk] = useState<FKResult>({ gradeLevel: 0, words: 0, sentences: 0, syllables: 0 });
  const [activeWriteupId, setActiveWriteupId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [writeupStatus, setWriteupStatus] = useState<"draft" | "published">("draft");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  // Wine metadata
  const [wineDetails, setWineDetails] = useState<WineDetails>({
    wineName: "", varietal: "", region: "", points: "", priceDiscount: "", tastingNotes: "", scarcityAngle: "",
  });

  // Tabs
  const [activeTab, setActiveTab] = useState<Tab>("Research");

  // Critique
  const [critiqueData, setCritiqueData] = useState<CritiqueData | null>(null);
  const [critiqueLoading, setCritiqueLoading] = useState(false);
  const [itemStatuses, setItemStatuses] = useState<Record<string, CardStatus>>({});

  // Publishing
  const [publishing, setPublishing] = useState(false);

  // Refs
  const fkTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const autoSaveRef = useRef<ReturnType<typeof setInterval>>(null);
  const lastSavedContentRef = useRef(content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Derived
  const overallScore = critiqueData?.overallScore ?? null;

  // Debounced FK calculation
  useEffect(() => {
    if (fkTimerRef.current) clearTimeout(fkTimerRef.current);
    fkTimerRef.current = setTimeout(() => {
      setFk(calculateFK(content));
    }, 300);
    return () => { if (fkTimerRef.current) clearTimeout(fkTimerRef.current); };
  }, [content]);

  // Load writeup from URL param on mount
  useEffect(() => {
    if (!writeupId) return;
    fetch(`/api/writeups/${writeupId}?brand=${BRAND}`)
      .then((res) => res.ok ? res.json() : null)
      .then((w: Writeup | null) => {
        if (!w) return;
        setTitle(w.title);
        setContent(w.content);
        setActiveWriteupId(w.id);
        setWriteupStatus(w.status);
        setLastSavedAt(w.updatedAt);
        lastSavedContentRef.current = w.content;
      })
      .catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []); // run once on mount — writeupId is stable from URL

  // Save draft
  const saveDraft = useCallback(async () => {
    if (!content.trim()) return;
    const saveTitle = title.trim() || content.trim().split("\n")[0].slice(0, 60) || "Untitled";
    setSaveStatus("saving");

    try {
      if (activeWriteupId) {
        const res = await fetch(`/api/writeups/${activeWriteupId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brand: BRAND, title: saveTitle, content,
            status: writeupStatus,
            score: overallScore,
          }),
        });
        if (res.ok) {
          const updated = await res.json();
          if (!title.trim()) setTitle(saveTitle);
          setLastSavedAt(updated.updatedAt);
          lastSavedContentRef.current = content;
          setSaveStatus("saved");
        } else {
          setSaveStatus("error");
        }
      } else {
        const res = await fetch("/api/writeups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brand: BRAND, title: saveTitle, content,
            status: writeupStatus,
            score: overallScore,
          }),
        });
        if (res.ok) {
          const writeup = await res.json();
          setActiveWriteupId(writeup.id);
          if (!title.trim()) setTitle(saveTitle);
          setLastSavedAt(writeup.updatedAt);
          lastSavedContentRef.current = content;
          setSaveStatus("saved");
        } else {
          setSaveStatus("error");
        }
      }
    } catch {
      setSaveStatus("error");
    }

    setTimeout(() => setSaveStatus("idle"), 2000);
  }, [content, title, activeWriteupId, writeupStatus, overallScore]);

  // Auto-save every 30s
  useEffect(() => {
    autoSaveRef.current = setInterval(() => {
      if (content.trim() && content !== lastSavedContentRef.current) {
        saveDraft();
      }
    }, AUTO_SAVE_INTERVAL);
    return () => { if (autoSaveRef.current) clearInterval(autoSaveRef.current); };
  }, [saveDraft, content]);

  // Run structured review
  const runReview = async () => {
    if (!content.trim()) return;
    setCritiqueLoading(true);
    try {
      const res = await fetch("/api/critique", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand: BRAND, draft: `Title: ${title}\n\n${content}` }),
      });
      if (res.ok) {
        const data = await res.json();
        setCritiqueData(data);
        setItemStatuses({});
      } else if (res.status === 429) {
        setNotification("Rate limited — try again in 30s");
        setTimeout(() => setNotification(null), 5000);
      } else {
        const data = await res.json().catch(() => ({}));
        setNotification(data.error || "Review failed");
        setTimeout(() => setNotification(null), 5000);
      }
    } catch {
      setNotification("Network error");
      setTimeout(() => setNotification(null), 5000);
    }
    setCritiqueLoading(false);
  };

  // Apply fix
  const applyFix = (line: string, fix: string, itemId: string) => {
    if (content.includes(line)) {
      setContent(content.replace(line, fix));
      setItemStatuses((prev) => ({ ...prev, [itemId]: "applied" }));
    } else {
      navigator.clipboard.writeText(fix);
      setNotification("Text not found — fix copied to clipboard");
      setTimeout(() => setNotification(null), 3000);
      setItemStatuses((prev) => ({ ...prev, [itemId]: "applied" }));
    }
  };

  // Dismiss item
  const dismissItem = (itemId: string) => {
    setItemStatuses((prev) => ({ ...prev, [itemId]: "dismissed" }));
  };

  // Click item — scroll to text in editor
  const clickItem = (_itemId: string, line: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const idx = content.indexOf(line);
    if (idx === -1) return;
    textarea.focus();
    textarea.setSelectionRange(idx, idx + line.length);
    const linesBefore = content.slice(0, idx).split("\n").length;
    const lineHeight = 20;
    textarea.scrollTop = Math.max(0, (linesBefore - 3) * lineHeight);
  };

  // Publish / unpublish
  const handlePublish = async () => {
    setPublishing(true);
    setWriteupStatus("published");
    if (activeWriteupId) {
      await fetch(`/api/writeups/${activeWriteupId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: BRAND, status: "published", score: overallScore,
          title: title || "Untitled", content,
        }),
      });
    } else {
      const res = await fetch("/api/writeups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: BRAND, title: title || "Untitled", content,
          status: "published", score: overallScore,
        }),
      });
      if (res.ok) {
        const writeup = await res.json();
        setActiveWriteupId(writeup.id);
        setLastSavedAt(writeup.updatedAt);
      }
    }
    setPublishing(false);
  };

  const handleUnpublish = async () => {
    if (!activeWriteupId) return;
    setPublishing(true);
    setWriteupStatus("draft");
    await fetch(`/api/writeups/${activeWriteupId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brand: BRAND, status: "draft", title, content }),
    });
    setPublishing(false);
  };

  // Insert content handler for ResearchPanel
  const handleInsertContent = (text: string) => {
    setContent(text);
  };

  const fkLevel = getFKLevel(fk.gradeLevel);
  const fkBadgeColor =
    fkLevel === "green" ? "text-green-600" : fkLevel === "yellow" ? "text-amber-600" : "text-red-500";

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Notification toast */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 rounded-lg bg-foreground text-background text-sm shadow-lg">
          {notification}
        </div>
      )}

      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/copywriting/library")}
            className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Library
          </button>
          <span className="text-border">|</span>
          <h1 className="text-sm font-medium text-foreground truncate max-w-xs">
            {title || "New writeup"}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          {fk.words > 0 && (
            <span className={`text-xs font-medium ${fkBadgeColor}`}>
              FK {fk.gradeLevel}
            </span>
          )}
          {overallScore !== null && (
            <ScoreRing score={overallScore} size={36} strokeWidth={3} />
          )}
          {fk.words > 0 && (
            <span className="text-xs text-muted">{fk.words} words</span>
          )}
        </div>
      </div>

      {/* Main split pane */}
      <div className="flex-1 overflow-hidden lg:grid lg:grid-cols-[1fr_400px] lg:gap-0">
        {/* Left: Editor */}
        <div className="p-4 overflow-y-auto border-r border-border">
          <EditorPanel
            title={title}
            onTitleChange={setTitle}
            content={content}
            onContentChange={setContent}
            fk={fk}
            saveStatus={saveStatus}
            onSave={saveDraft}
            textareaRef={textareaRef}
          />
        </div>

        {/* Right: Tools panel */}
        <div className="flex flex-col overflow-hidden bg-surface/50">
          {/* Tabs */}
          <div className="flex border-b border-border shrink-0">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? "text-accent border-b-2 border-accent"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === "Research" && (
              <ResearchPanel
                wineDetails={wineDetails}
                onWineDetailsChange={setWineDetails}
                onInsertContent={handleInsertContent}
                title={title}
              />
            )}

            {activeTab === "Review" && (
              <ReviewPanel
                critiqueData={critiqueData}
                critiqueLoading={critiqueLoading}
                itemStatuses={itemStatuses}
                onRunReview={runReview}
                onApplyFix={applyFix}
                onDismissItem={dismissItem}
                onClickItem={clickItem}
              />
            )}

            {activeTab === "Publish" && (
              <PublishPanel
                status={writeupStatus}
                score={overallScore}
                lastSaved={lastSavedAt}
                content={content}
                onPublish={handlePublish}
                onUnpublish={handleUnpublish}
                publishing={publishing}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EditorPage() {
  return (
    <Suspense fallback={null}>
      <EditorPageInner />
    </Suspense>
  );
}
```

- [ ] **Step 2: Verify the single-writeup fetch API route exists**

Check that `GET /api/writeups/[id]` is implemented. Run:

```bash
grep -r "export async function GET" app/api/writeups/
```

Expected output includes a line from `app/api/writeups/[id]/route.ts`. If it doesn't exist, that file needs to handle GET. Check the file:

```bash
cat app/api/writeups/\[id\]/route.ts
```

If there is no GET handler in that file, add one above the PUT handler:

```ts
export async function GET(req: Request, { params }: { params: { id: string } }) {
  const { searchParams } = new URL(req.url);
  const brandId = searchParams.get("brand") || "winespies";
  const data = await readWriteups(brandId);
  const writeup = data.writeups.find((w) => w.id === params.id) ?? null;
  if (!writeup) return NextResponse.json({ error: "Not found" }, { status: 404 });
  return NextResponse.json(writeup);
}
```

- [ ] **Step 3: Verify in browser**

Run `npm run dev`. Check:
- Navigate to `/copywriting/editor` (no ID) — blank editor loads, header shows "New writeup"
- Navigate to library, click "Open" on any item — editor loads with that writeup's title + content
- Header shows "← Library | [title]"
- No DraftsDrawer visible anywhere at the bottom
- Auto-save still works (wait 30s after typing)
- Publish/Unpublish in the Publish tab still works

- [ ] **Step 4: Commit**

```bash
git add app/copywriting/editor/page.tsx
git commit -m "feat: load writeup from URL param, remove DraftsDrawer from editor"
```

---

## Task 3: Delete DraftsDrawer Component

**Files:**
- Delete: `app/copywriting/editor/components/DraftsDrawer.tsx`

- [ ] **Step 1: Verify nothing imports DraftsDrawer**

```bash
grep -r "DraftsDrawer" app/
```

Expected: no output (the editor no longer imports it after Task 2).

- [ ] **Step 2: Delete the file**

```bash
rm app/copywriting/editor/components/DraftsDrawer.tsx
```

- [ ] **Step 3: Verify build is clean**

```bash
npm run build 2>&1 | tail -20
```

Expected: build completes with no errors.

- [ ] **Step 4: Commit**

```bash
git add -A
git commit -m "chore: delete unused DraftsDrawer component"
```

---

## Self-Review

**Spec coverage:**
- ✅ Library fetches all writeups (no status filter in API call)
- ✅ Status tabs: All / Draft / Published
- ✅ "Open" passes writeup ID in URL
- ✅ Status toggle: Publish / Unpublish per item
- ✅ Delete button on each row
- ✅ Status badge on each row
- ✅ "New writeup" button in library header
- ✅ Updated empty states per tab
- ✅ Editor loads writeup from `?id` URL param
- ✅ DraftsDrawer removed from editor
- ✅ `writeups` state and `loadWriteups` removed from editor
- ✅ "← Library" back link in editor header
- ✅ Suspense wrapper for `useSearchParams`
- ✅ DraftsDrawer file deleted

**Potential gotcha:** The editor's `h-[calc(100vh-3.5rem)]` height accounts for the editor's own header bar (3.5rem). If the UI cleanup TopBar is implemented separately, this calc may need adjustment — but that's a separate task.
