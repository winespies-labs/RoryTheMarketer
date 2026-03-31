"use client";

import { useState, useEffect } from "react";
import type { InstagramPost } from "@/lib/instagram-research";

const BRAND_ID = "winespies";

interface SavedSearchMeta {
  id: string;
  keyword: string;
  searchedAt: string;
  resultCount: number;
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return String(n);
}

function timeAgo(ts: string): string {
  if (!ts) return "";
  const d = new Date(ts.length <= 10 ? Number(ts) * 1000 : ts);
  if (isNaN(d.getTime())) return "";
  const diff = Date.now() - d.getTime();
  const days = Math.floor(diff / 86400000);
  if (days > 30) return d.toLocaleDateString();
  if (days > 0) return `${days}d ago`;
  const hours = Math.floor(diff / 3600000);
  if (hours > 0) return `${hours}h ago`;
  return "just now";
}

export default function InstagramResearchPage() {
  // Search state
  const [keyword, setKeyword] = useState("");
  const [limit, setLimit] = useState(30);
  const [searching, setSearching] = useState(false);
  const [searchError, setSearchError] = useState("");

  // Results state (current search, not yet saved)
  const [currentKeyword, setCurrentKeyword] = useState("");
  const [posts, setPosts] = useState<InstagramPost[]>([]);
  const [resultCount, setResultCount] = useState(0);

  // Transcription state
  const [transcribing, setTranscribing] = useState<Set<string>>(new Set());
  const [transcripts, setTranscripts] = useState<Record<string, string>>({});

  // Saved searches
  const [savedSearches, setSavedSearches] = useState<SavedSearchMeta[]>([]);
  const [loadedSearchId, setLoadedSearchId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  // Load saved searches on mount
  useEffect(() => {
    fetchSavedSearches();
  }, []);

  async function fetchSavedSearches() {
    try {
      const res = await fetch(`/api/instagram-research/searches?brand=${BRAND_ID}`);
      const data = await res.json();
      setSavedSearches(data.searches || []);
    } catch {
      // ignore
    }
  }

  async function handleSearch() {
    if (!keyword.trim() || searching) return;
    setSearching(true);
    setSearchError("");
    setPosts([]);
    setCurrentKeyword("");
    setLoadedSearchId(null);
    setTranscripts({});

    try {
      const res = await fetch("/api/instagram-research/search", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand: BRAND_ID, keyword: keyword.trim(), limit }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Search failed");

      setPosts(data.posts || []);
      setResultCount(data.resultCount || 0);
      setCurrentKeyword(data.keyword || keyword.trim());
    } catch (e) {
      setSearchError(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearching(false);
    }
  }

  async function handleTranscribe(post: InstagramPost) {
    if (!post.videoUrl || transcribing.has(post.id)) return;

    setTranscribing((prev) => new Set(prev).add(post.id));

    try {
      const res = await fetch("/api/instagram-research/transcribe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: BRAND_ID,
          searchId: loadedSearchId ?? undefined,
          postId: post.id,
          videoUrl: post.videoUrl,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Transcription failed");

      setTranscripts((prev) => ({ ...prev, [post.id]: data.transcript }));
      // Also update the post in-place for consistency
      setPosts((prev) =>
        prev.map((p) =>
          p.id === post.id ? { ...p, transcript: data.transcript, transcribedAt: new Date().toISOString() } : p
        )
      );
    } catch (e) {
      setTranscripts((prev) => ({
        ...prev,
        [post.id]: `Error: ${e instanceof Error ? e.message : "Transcription failed"}`,
      }));
    } finally {
      setTranscribing((prev) => {
        const next = new Set(prev);
        next.delete(post.id);
        return next;
      });
    }
  }

  async function handleSaveSearch() {
    if (saving || posts.length === 0) return;
    setSaving(true);

    try {
      const res = await fetch("/api/instagram-research/searches", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand: BRAND_ID, keyword: currentKeyword, posts }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Save failed");

      setLoadedSearchId(data.search.id);
      await fetchSavedSearches();
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  }

  async function handleLoadSearch(searchId: string) {
    try {
      const res = await fetch(
        `/api/instagram-research/searches?brand=${BRAND_ID}&loadId=${searchId}`
      );
      const data = await res.json();
      if (!res.ok || !data.search) return;

      setPosts(data.search.posts || []);
      setCurrentKeyword(data.search.keyword);
      setResultCount(data.search.resultCount);
      setLoadedSearchId(searchId);

      // Pre-populate transcripts from saved posts
      const saved: Record<string, string> = {};
      for (const p of data.search.posts || []) {
        if (p.transcript) saved[p.id] = p.transcript;
      }
      setTranscripts(saved);
    } catch {
      // ignore
    }
  }

  async function handleDeleteSearch(searchId: string) {
    try {
      await fetch(`/api/instagram-research/searches?brand=${BRAND_ID}&id=${searchId}`, {
        method: "DELETE",
      });
      setSavedSearches((prev) => prev.filter((s) => s.id !== searchId));
      if (loadedSearchId === searchId) {
        setLoadedSearchId(null);
        setPosts([]);
        setCurrentKeyword("");
      }
    } catch {
      // ignore
    }
  }

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight mb-1">IG Research</h1>
      <p className="text-muted mb-6">
        Discover trending Instagram content by keyword. Browse posts, view engagement stats, and
        transcribe video content.
      </p>

      {/* Search bar */}
      <div className="rounded-xl border border-border bg-surface p-6 mb-6">
        <div className="flex gap-3 items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-muted mb-1.5">Keyword</label>
            <input
              type="text"
              value={keyword}
              onChange={(e) => setKeyword(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && handleSearch()}
              placeholder="e.g. wine, skincare, fitness..."
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-accent/30"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">Limit</label>
            <select
              value={limit}
              onChange={(e) => setLimit(Number(e.target.value))}
              className="px-3 py-2 text-sm border border-border rounded-lg bg-background text-foreground focus:outline-none focus:ring-2 focus:ring-accent/30"
            >
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={30}>30</option>
              <option value={50}>50</option>
            </select>
          </div>
          <button
            type="button"
            onClick={handleSearch}
            disabled={!keyword.trim() || searching}
            className="px-5 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {searching ? "Searching..." : "Search"}
          </button>
        </div>
        {searching && (
          <p className="text-xs text-muted mt-3">
            Searching Instagram... this may take up to 2 minutes.
          </p>
        )}
        {searchError && (
          <p className="text-sm text-danger mt-3">{searchError}</p>
        )}
      </div>

      {/* Results feed */}
      {posts.length > 0 && (
        <div className="mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-medium">
                &ldquo;{currentKeyword}&rdquo;
              </h2>
              <p className="text-xs text-muted">{resultCount} posts found</p>
            </div>
            {!loadedSearchId && (
              <button
                type="button"
                onClick={handleSaveSearch}
                disabled={saving}
                className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-surface transition-colors disabled:opacity-50"
              >
                {saving ? "Saving..." : "Save Search"}
              </button>
            )}
            {loadedSearchId && (
              <span className="text-xs text-muted bg-surface border border-border px-3 py-1.5 rounded-lg">
                Saved
              </span>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {posts.map((post) => (
              <PostCard
                key={post.id}
                post={post}
                transcript={transcripts[post.id] ?? post.transcript}
                isTranscribing={transcribing.has(post.id)}
                onTranscribe={() => handleTranscribe(post)}
              />
            ))}
          </div>
        </div>
      )}

      {/* Saved searches */}
      {savedSearches.length > 0 && (
        <div className="rounded-xl border border-border bg-surface p-6">
          <h2 className="text-sm font-medium text-foreground mb-4">
            Saved Searches ({savedSearches.length})
          </h2>
          <div className="space-y-2">
            {savedSearches.map((s) => (
              <div
                key={s.id}
                className="flex items-center justify-between px-4 py-3 border border-border rounded-lg"
              >
                <div>
                  <span className="text-sm font-medium">&ldquo;{s.keyword}&rdquo;</span>
                  <span className="text-xs text-muted ml-3">
                    {s.resultCount} posts &middot; {timeAgo(s.searchedAt)}
                  </span>
                </div>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => handleLoadSearch(s.id)}
                    className="text-xs text-accent hover:underline"
                  >
                    Load
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteSearch(s.id)}
                    className="text-xs text-muted hover:text-danger transition-colors"
                  >
                    Delete
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function PostCard({
  post,
  transcript,
  isTranscribing,
  onTranscribe,
}: {
  post: InstagramPost;
  transcript?: string;
  isTranscribing: boolean;
  onTranscribe: () => void;
}) {
  return (
    <div className="rounded-lg border border-border overflow-hidden bg-surface">
      {/* Thumbnail */}
      {post.displayUrl && (
        <div className="relative aspect-square bg-background">
          <img
            src={post.displayUrl}
            alt={post.caption?.slice(0, 60) || "Instagram post"}
            className="w-full h-full object-cover"
            loading="lazy"
          />
          {post.type === "Video" && (
            <span className="absolute top-2 right-2 bg-black/70 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
              VIDEO
            </span>
          )}
          {post.type === "Sidecar" && (
            <span className="absolute top-2 right-2 bg-black/70 text-white text-[10px] font-medium px-1.5 py-0.5 rounded">
              CAROUSEL
            </span>
          )}
        </div>
      )}

      <div className="p-3 space-y-2">
        {/* Username */}
        <p className="text-xs font-medium text-accent">@{post.ownerUsername}</p>

        {/* Caption */}
        {post.caption && (
          <p className="text-xs text-foreground line-clamp-3">{post.caption}</p>
        )}

        {/* Stats */}
        <div className="flex gap-3 text-[11px] text-muted">
          <span>{formatNumber(post.likesCount)} likes</span>
          <span>{formatNumber(post.commentsCount)} comments</span>
          {post.videoViewCount != null && post.videoViewCount > 0 && (
            <span>{formatNumber(post.videoViewCount)} views</span>
          )}
        </div>

        {/* Timestamp */}
        {post.timestamp && (
          <p className="text-[10px] text-muted">{timeAgo(post.timestamp)}</p>
        )}

        {/* Actions */}
        <div className="flex items-center gap-3 pt-1 border-t border-border">
          <a
            href={post.url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[11px] text-accent hover:underline"
          >
            Open on Instagram
          </a>

          {post.type === "Video" && post.videoUrl && !transcript && (
            <button
              type="button"
              onClick={onTranscribe}
              disabled={isTranscribing}
              className="text-[11px] text-accent hover:underline disabled:opacity-50"
            >
              {isTranscribing ? "Transcribing..." : "Transcribe"}
            </button>
          )}
        </div>

        {/* Transcript */}
        {transcript && (
          <div className="bg-background border border-border rounded p-2 mt-1">
            <p className="text-[10px] font-medium text-muted mb-1">Transcript</p>
            <p className="text-xs text-foreground whitespace-pre-wrap">{transcript}</p>
          </div>
        )}
      </div>
    </div>
  );
}
