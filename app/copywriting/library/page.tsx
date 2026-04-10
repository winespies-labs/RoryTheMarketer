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

const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

const STATUS_TABS: { key: StatusFilter; label: string }[] = [
  { key: "all", label: "All" },
  { key: "draft", label: "Draft" },
  { key: "published", label: "Published" },
];

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
    try {
      await fetch(`/api/writeups/${id}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand: BRAND, status: newStatus }),
      });
      await loadWriteups();
    } catch { /* silently handle */ }
  };

  const handleDelete = async (id: string, title: string) => {
    if (!window.confirm(`Delete "${title}"? This cannot be undone.`)) return;
    try {
      await fetch(`/api/writeups/${id}?brand=${BRAND}`, { method: "DELETE" });
      await loadWriteups();
    } catch { /* silently handle */ }
  };

  const emptyMessage =
    statusFilter === "draft"
      ? search ? "No drafts match your search." : "No drafts yet. Start a new writeup."
      : statusFilter === "published"
      ? search ? "No published writeups match your search." : "No published writeups yet."
      : search ? "No writeups match your search."
      : "No writeups yet. Start writing.";

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
                  onClick={() => handleDelete(w.id, w.title)}
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
