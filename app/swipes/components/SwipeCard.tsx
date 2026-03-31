"use client";

import type { UnifiedSwipe } from "@/lib/unified-swipe";

const SOURCE_BADGE: Record<string, { label: string; className: string }> = {
  library: {
    label: "Library",
    className: "bg-blue-50 text-blue-700 border-blue-200",
  },
  drill: {
    label: "Drill",
    className: "bg-purple-50 text-purple-700 border-purple-200",
  },
  extracted: {
    label: "Extracted",
    className: "bg-amber-50 text-amber-700 border-amber-200",
  },
};

export default function SwipeCard({
  swipe,
  onSelect,
  onToggleStar,
}: {
  swipe: UnifiedSwipe;
  onSelect: (s: UnifiedSwipe) => void;
  onToggleStar?: (s: UnifiedSwipe) => void;
}) {
  const badge = SOURCE_BADGE[swipe.source] ?? SOURCE_BADGE.library;

  return (
    <div
      role="button"
      tabIndex={0}
      onClick={() => onSelect(swipe)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") onSelect(swipe);
      }}
      className="group rounded-xl border border-border bg-surface p-4 hover:border-accent transition-colors cursor-pointer"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="text-sm font-medium group-hover:text-accent transition-colors truncate">
            {swipe.title}
          </div>
          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
            <span
              className={`px-1.5 py-0.5 text-[10px] font-medium border rounded ${badge.className}`}
            >
              {badge.label}
            </span>
            {swipe.category && swipe.category !== "Uncategorized" && (
              <span className="px-1.5 py-0.5 text-[10px] font-medium bg-surface border border-border rounded text-muted">
                {swipe.category}
              </span>
            )}
          </div>
        </div>
        {swipe.source === "library" && onToggleStar && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              onToggleStar(swipe);
            }}
            className={`text-sm px-2 py-1 rounded border shrink-0 transition-colors ${
              swipe.starred
                ? "bg-accent text-white border-accent"
                : "bg-background text-muted border-border hover:border-accent"
            }`}
            title="Star for copywriting context"
          >
            {swipe.starred ? "Starred" : "Star"}
          </button>
        )}
      </div>
      <p className="text-sm text-muted mt-3 whitespace-pre-wrap line-clamp-3">
        {swipe.content}
      </p>
      {swipe.tags.length > 0 && (
        <div className="flex flex-wrap gap-1 mt-2">
          {swipe.tags.slice(0, 4).map((tag) => (
            <span
              key={tag}
              className="px-1.5 py-0.5 text-[10px] bg-background text-muted rounded border border-border"
            >
              {tag}
            </span>
          ))}
          {swipe.tags.length > 4 && (
            <span className="text-[10px] text-muted">
              +{swipe.tags.length - 4}
            </span>
          )}
        </div>
      )}
    </div>
  );
}
