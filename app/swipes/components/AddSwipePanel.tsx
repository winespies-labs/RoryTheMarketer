"use client";

import { useState, useRef } from "react";

const BRAND_ID = "winespies";
const SWIPE_TYPES = ["swipe", "copywriting", "ad_copy"] as const;
type SwipeType = (typeof SWIPE_TYPES)[number];

export default function AddSwipePanel({
  onAdded,
}: {
  onAdded: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    type: "swipe" as SwipeType,
    title: "",
    content: "",
    tagsStr: "",
    whyItWorks: "",
  });

  // Markdown import
  const mdFileRef = useRef<HTMLInputElement>(null);
  const [importing, setImporting] = useState(false);
  const [importResult, setImportResult] = useState<{
    parsedCount: number;
    insertedCount: number;
  } | null>(null);
  const [importError, setImportError] = useState("");
  const [importOverwrite, setImportOverwrite] = useState(false);

  const addSwipe = async (e: React.FormEvent) => {
    e.preventDefault();
    const tags = form.tagsStr
      .split(/[\s,]+/)
      .map((t) => t.trim())
      .filter(Boolean);
    const meta: Record<string, unknown> = {};
    if (form.whyItWorks.trim()) meta.whyItWorks = form.whyItWorks.trim();

    const res = await fetch("/api/context-library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brand: BRAND_ID,
        type: form.type,
        title: form.title || undefined,
        content: form.content,
        tags: tags.length ? tags : undefined,
        meta: Object.keys(meta).length > 0 ? meta : undefined,
      }),
    });
    if (!res.ok) return;
    setForm({ type: "swipe", title: "", content: "", tagsStr: "", whyItWorks: "" });
    onAdded();
  };

  const handleMarkdownImport = async (file: File) => {
    setImporting(true);
    setImportResult(null);
    setImportError("");
    try {
      const markdown = await file.text();
      const res = await fetch("/api/swipe-files/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: BRAND_ID,
          markdown,
          overwrite: importOverwrite,
          type: "swipe",
        }),
      });
      const raw = await res.text();
      let data: { error?: string; parsedCount?: number; insertedCount?: number } = {};
      if (raw.trim()) {
        try {
          data = JSON.parse(raw);
        } catch {
          setImportError(`Server returned non-JSON (${res.status}).`);
          return;
        }
      } else if (!res.ok) {
        setImportError(`Import failed (${res.status}): empty response`);
        return;
      }
      if (!res.ok) {
        setImportError(data.error || `Import failed (${res.status})`);
        return;
      }
      setImportResult({
        parsedCount: data.parsedCount ?? 0,
        insertedCount: data.insertedCount ?? 0,
      });
      onAdded();
    } catch (err) {
      setImportError(err instanceof Error ? err.message : "Import failed");
    } finally {
      setImporting(false);
      if (mdFileRef.current) mdFileRef.current.value = "";
    }
  };

  if (!open) {
    return (
      <div className="flex gap-2">
        <button
          onClick={() => setOpen(true)}
          className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:opacity-90"
        >
          + Add Swipe
        </button>
        <button
          onClick={() => mdFileRef.current?.click()}
          disabled={importing}
          className="px-4 py-2 text-sm font-medium border border-border rounded-lg bg-surface hover:bg-background transition-colors disabled:opacity-50"
        >
          {importing ? "Importing..." : "Import MD"}
        </button>
        <input
          ref={mdFileRef}
          type="file"
          accept=".md,.markdown,.txt"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) handleMarkdownImport(file);
          }}
          className="hidden"
        />
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-foreground">Add swipe</h2>
        <button
          onClick={() => setOpen(false)}
          className="text-xs text-muted hover:text-foreground"
        >
          Close
        </button>
      </div>

      <form onSubmit={addSwipe} className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-muted mb-1">Type</label>
            <select
              value={form.type}
              onChange={(e) =>
                setForm((f) => ({ ...f, type: e.target.value as SwipeType }))
              }
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
            >
              {SWIPE_TYPES.map((type) => (
                <option key={type} value={type}>
                  {type}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">
              Title (optional)
            </label>
            <input
              type="text"
              value={form.title}
              onChange={(e) =>
                setForm((f) => ({ ...f, title: e.target.value }))
              }
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-muted mb-1">Swipe text</label>
            <textarea
              value={form.content}
              onChange={(e) =>
                setForm((f) => ({ ...f, content: e.target.value }))
              }
              rows={3}
              required
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background resize-y"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Tags</label>
            <input
              type="text"
              value={form.tagsStr}
              onChange={(e) =>
                setForm((f) => ({ ...f, tagsStr: e.target.value }))
              }
              placeholder="wine-writeup, offer, urgency"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">
              Why it works
            </label>
            <input
              type="text"
              value={form.whyItWorks}
              onChange={(e) =>
                setForm((f) => ({ ...f, whyItWorks: e.target.value }))
              }
              placeholder="optional"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
            />
          </div>
        </div>
        <button
          type="submit"
          className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:opacity-90"
        >
          Save swipe
        </button>
      </form>

      {/* Markdown import section */}
      <div className="mt-4 pt-4 border-t border-border">
        <div className="flex items-center justify-between mb-2">
          <h3 className="text-xs font-medium text-muted">Import from Markdown</h3>
          <label className="flex items-center gap-2 text-xs text-muted">
            <input
              type="checkbox"
              checked={importOverwrite}
              onChange={(e) => setImportOverwrite(e.target.checked)}
              className="rounded border-border"
            />
            Replace all
          </label>
        </div>
        <div className="flex items-center gap-3">
          <input
            ref={mdFileRef}
            type="file"
            accept=".md,.markdown,.txt"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleMarkdownImport(file);
            }}
            className="hidden"
          />
          <button
            type="button"
            onClick={() => mdFileRef.current?.click()}
            disabled={importing}
            className="px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-lg hover:opacity-90 disabled:opacity-50"
          >
            {importing ? "Importing..." : "Upload .md"}
          </button>
          <p className="text-xs text-muted">
            Parses ## sections into tagged swipes.
          </p>
        </div>
        {importResult && (
          <p className="text-xs text-green-600 mt-2">
            Parsed {importResult.parsedCount}, inserted{" "}
            {importResult.insertedCount}.
          </p>
        )}
        {importError && (
          <p className="text-xs text-red-600 mt-2">{importError}</p>
        )}
      </div>
    </div>
  );
}
