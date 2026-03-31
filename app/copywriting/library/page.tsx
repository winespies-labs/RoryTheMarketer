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

const BRAND = "winespies";

export default function LibraryPage() {
  const router = useRouter();
  const [writeups, setWriteups] = useState<Writeup[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");

  const loadWriteups = useCallback(async () => {
    try {
      const res = await fetch(`/api/writeups?brand=${BRAND}&status=published`);
      if (res.ok) setWriteups(await res.json());
    } catch { /* silently handle */ }
    setLoading(false);
  }, []);

  useEffect(() => { loadWriteups(); }, [loadWriteups]);

  const filtered = writeups.filter(
    (w) => w.title.toLowerCase().includes(search.toLowerCase())
  );

  const handleUnpublish = async (id: string) => {
    await fetch(`/api/writeups/${id}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brand: BRAND, status: "draft" }),
    });
    await loadWriteups();
  };

  const wordCount = (text: string) => text.split(/\s+/).filter(Boolean).length;

  return (
    <div>
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Library</h1>
          <p className="text-sm text-muted mt-1">Published write-ups ready for use.</p>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by title..."
          className="w-full max-w-md px-4 py-2.5 text-sm border border-border rounded-lg bg-surface focus:outline-none focus:border-accent transition-colors"
        />
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
          <p className="text-muted">
            {search ? "No published writeups match your search." : "No published writeups yet. Write and publish from the Editor."}
          </p>
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
                <h3 className="text-sm font-semibold truncate">{w.title}</h3>
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
                  onClick={() => router.push(`/copywriting/editor`)}
                  className="px-3 py-1.5 text-xs bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
                >
                  Open
                </button>
                <button
                  onClick={() => handleUnpublish(w.id)}
                  className="px-3 py-1.5 text-xs text-muted hover:text-danger transition-colors"
                >
                  Unpublish
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
