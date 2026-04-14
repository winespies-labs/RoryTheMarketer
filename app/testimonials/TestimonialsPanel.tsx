"use client";

import { useState, useEffect, useCallback } from "react";
import type { Review, UspCategory } from "@/lib/reviews";

type SortOption = "score" | "date" | "rating";
type TabOption = "all" | UspCategory | "unscored";

const USP_TABS: { key: TabOption; label: string }[] = [
  { key: "all", label: "All" },
  { key: "best-price", label: "Best Price" },
  { key: "locker", label: "The Locker" },
  { key: "satisfaction-guaranteed", label: "Satisfaction Guaranteed" },
  { key: "unscored", label: "Unscored" },
];

const USP_BADGE: Record<UspCategory, { label: string; className: string }> = {
  "best-price": {
    label: "Best Price",
    className: "bg-green-100 text-green-800",
  },
  locker: { label: "The Locker", className: "bg-blue-100 text-blue-800" },
  "satisfaction-guaranteed": {
    label: "Guaranteed",
    className: "bg-purple-100 text-purple-800",
  },
};

function StarRating({ rating }: { rating?: number | null }) {
  if (!rating) return null;
  return (
    <span className="text-yellow-500 text-xs">
      {"★".repeat(rating)}
      {"☆".repeat(5 - rating)}
    </span>
  );
}

function TestimonialCard({
  review,
  onStar,
}: {
  review: Review;
  onStar: (id: string, starred: boolean) => void;
}) {
  const [expanded, setExpanded] = useState(false);
  const [copied, setCopied] = useState(false);

  const uspBadge =
    review.uspCategory ? USP_BADGE[review.uspCategory] : null;

  useEffect(() => {
    if (!copied) return;
    const timer = setTimeout(() => setCopied(false), 1500);
    return () => clearTimeout(timer);
  }, [copied]);

  const handleCopy = async () => {
    const text = review.extractedQuote ?? review.content.slice(0, 200);
    await navigator.clipboard.writeText(text);
    setCopied(true);
  };

  return (
    <div className="rounded-xl border border-border bg-surface p-5 flex flex-col gap-3">
      {/* Quote */}
      <p className="text-sm font-medium text-foreground leading-relaxed">
        {review.extractedQuote ? (
          <>&ldquo;{review.extractedQuote}&rdquo;</>

        ) : (
          <span className="text-muted italic">
            {review.content.slice(0, 200)}
            {review.content.length > 200 ? "…" : ""}
          </span>
        )}
      </p>

      {/* Meta row */}
      <div className="flex items-center gap-2 flex-wrap">
        {review.author && (
          <span className="text-xs text-muted">— {review.author}</span>
        )}
        <StarRating rating={review.rating} />
        {uspBadge && (
          <span
            className={`text-[11px] font-medium px-2 py-0.5 rounded-full ${uspBadge.className}`}
          >
            {uspBadge.label}
          </span>
        )}
        {review.adScore != null ? (
          <span className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-accent/10 text-accent">
            {review.adScore}
          </span>
        ) : (
          <span className="text-[11px] text-muted italic">Not yet scored</span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2 pt-1 border-t border-border/40">
        <button
          onClick={handleCopy}
          className="text-xs text-muted hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-background"
        >
          {copied ? "Copied!" : "Copy quote"}
        </button>
        <button
          onClick={() => setExpanded((v) => !v)}
          className="text-xs text-muted hover:text-foreground transition-colors px-2 py-1 rounded hover:bg-background"
        >
          {expanded ? "Hide review" : "Full review"}
        </button>
        <div className="flex-1" />
        <button
          onClick={() => onStar(review.id, !review.starred)}
          className={`text-sm transition-colors ${
            review.starred ? "text-yellow-500" : "text-muted hover:text-yellow-500"
          }`}
          title={review.starred ? "Unstar" : "Star"}
        >
          {review.starred ? "★" : "☆"}
        </button>
      </div>

      {expanded && (
        <p className="text-xs text-muted leading-relaxed border-t border-border/40 pt-3">
          {review.content}
        </p>
      )}
    </div>
  );
}

export default function TestimonialsPanel() {
  const [tab, setTab] = useState<TabOption>("all");
  const [sort, setSort] = useState<SortOption>("score");
  const [starredOnly, setStarredOnly] = useState(false);
  const [testimonials, setTestimonials] = useState<Review[]>([]);
  const [unscoredCount, setUnscoredCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [scoring, setScoring] = useState(false);
  const [scoredCount, setScoredCount] = useState(0);
  const [error, setError] = useState<string | null>(null);

  const fetchTestimonials = useCallback(async () => {
    setLoading(true);
    setError(null);
    const params = new URLSearchParams({ brand: "winespies", sort });
    if (tab === "unscored") params.set("unscored", "1");
    else if (tab !== "all") params.set("uspCategory", tab);
    if (starredOnly) params.set("starred", "1");
    params.set("limit", "200");

    const res = await fetch(`/api/testimonials?${params}`);
    if (!res.ok) {
      setError("Failed to load testimonials.");
      setLoading(false);
      return;
    }
    const data = await res.json() as {
      testimonials: Review[];
      unscoredCount: number;
    };
    setTestimonials(data.testimonials);
    setUnscoredCount(data.unscoredCount);
    setLoading(false);
  }, [tab, sort, starredOnly]);

  useEffect(() => { fetchTestimonials(); }, [fetchTestimonials]);

  const handleScore = async () => {
    setScoring(true);
    setScoredCount(0);
    let done = false;
    while (!done) {
      try {
        const res = await fetch("/api/testimonials/score?brand=winespies", { method: "POST" });
        if (!res.ok) break;
        const data = await res.json() as { scored: number; remaining: number };
        setScoredCount((prev) => prev + (data.scored ?? 0));
        if (data.remaining === 0 || data.scored === 0) done = true;
      } catch {
        done = true;
      }
    }
    setScoring(false);
    setScoredCount(0);
    await fetchTestimonials();
  };

  const handleStar = async (id: string, starred: boolean) => {
    setTestimonials((prev) =>
      prev.map((t) => (t.id === id ? { ...t, starred } : t))
    );
    try {
      const res = await fetch(`/api/reviews/${id}?brand=winespies`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ starred }),
      });
      if (!res.ok) throw new Error("Failed to update star");
    } catch {
      // Rollback optimistic update
      setTestimonials((prev) =>
        prev.map((t) => (t.id === id ? { ...t, starred: !starred } : t))
      );
    }
  };

  return (
    <div className="flex flex-col gap-4">
      {error && (
        <p className="text-sm text-danger text-center py-4">{error}</p>
      )}

      {/* Top bar */}
      <div className="flex items-center gap-3 flex-wrap">
        <button
          onClick={handleScore}
          disabled={scoring || unscoredCount === 0}
          className={`flex items-center gap-2 px-3 py-1.5 text-sm rounded-lg transition-colors ${
            unscoredCount > 0 && !scoring
              ? "bg-accent text-white hover:bg-accent/90"
              : "bg-border text-muted cursor-not-allowed"
          }`}
        >
          {scoring ? `Scoring… ${scoredCount} done` : "Score unscored"}
          {unscoredCount > 0 && !scoring && (
            <span className="bg-white/20 text-white text-[11px] font-bold px-1.5 py-0.5 rounded-full">
              {unscoredCount}
            </span>
          )}
        </button>

        <div className="flex-1" />

        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as SortOption)}
          className="text-sm border border-border rounded-lg px-3 py-1.5 bg-surface text-foreground"
        >
          <option value="score">Sort: Score</option>
          <option value="date">Sort: Date</option>
          <option value="rating">Sort: Rating</option>
        </select>

        <button
          onClick={() => setStarredOnly((v) => !v)}
          className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
            starredOnly
              ? "border-accent bg-accent/10 text-accent"
              : "border-border text-muted hover:text-foreground"
          }`}
        >
          ★ Starred only
        </button>
      </div>

      {/* USP filter tabs */}
      <div className="flex gap-1 flex-wrap">
        {USP_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-3 py-1.5 text-sm rounded-lg transition-colors ${
              tab === t.key
                ? "bg-accent text-white font-medium"
                : "text-muted hover:text-foreground hover:bg-background"
            }`}
          >
            {t.label}
            {t.key === "unscored" && unscoredCount > 0 && (
              <span className="ml-1.5 text-[11px] font-bold bg-white/20 text-current px-1.5 py-0.5 rounded-full">
                {unscoredCount}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Cards */}
      {loading ? (
        <div className="text-sm text-muted py-8 text-center">Loading…</div>
      ) : testimonials.length === 0 ? (
        <div className="text-sm text-muted py-8 text-center">
          {tab === "unscored"
            ? "All reviews have been scored."
            : "No testimonials found. Score unscored reviews to populate this view."}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((t) => (
            <TestimonialCard key={t.id} review={t} onStar={handleStar} />
          ))}
        </div>
      )}
    </div>
  );
}
