"use client";

import type { SwipeSource } from "@/lib/unified-swipe";

export interface SwipeFilterState {
  q: string;
  source: SwipeSource | "";
  starredOnly: boolean;
  selectedCategory: string;
  selectedTags: string[];
}

export default function SwipeFilters({
  filters,
  onChange,
  categories,
  tags,
  tagCounts,
}: {
  filters: SwipeFilterState;
  onChange: (f: SwipeFilterState) => void;
  categories: string[];
  tags: string[];
  tagCounts: Map<string, number>;
}) {
  const set = (partial: Partial<SwipeFilterState>) =>
    onChange({ ...filters, ...partial });

  return (
    <div className="space-y-4 mb-6">
      {/* Top row: search, source, starred */}
      <div className="flex gap-3 flex-wrap items-center">
        <input
          type="text"
          value={filters.q}
          onChange={(e) => set({ q: e.target.value })}
          placeholder="Search swipes..."
          className="px-3 py-2 text-sm border border-border rounded-lg bg-surface min-w-[220px]"
        />
        <select
          value={filters.source}
          onChange={(e) => set({ source: e.target.value as SwipeSource | "" })}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-surface"
        >
          <option value="">All sources</option>
          <option value="library">Library</option>
          <option value="drill">Drills</option>
          <option value="extracted">Extracted</option>
        </select>
        <label className="flex items-center gap-2 text-sm text-muted px-1">
          <input
            type="checkbox"
            checked={filters.starredOnly}
            onChange={(e) => set({ starredOnly: e.target.checked })}
            className="rounded border-border"
          />
          Starred only
        </label>
      </div>

      {/* Category chips */}
      {categories.length > 0 && (
        <div className="flex gap-1.5 flex-wrap">
          <button
            type="button"
            onClick={() => set({ selectedCategory: "" })}
            className={`px-3 py-1 text-xs rounded-full border transition-colors ${
              !filters.selectedCategory
                ? "bg-accent text-white border-accent"
                : "border-border text-muted hover:border-accent"
            }`}
          >
            All
          </button>
          {categories.map((cat) => (
            <button
              key={cat}
              type="button"
              onClick={() =>
                set({
                  selectedCategory:
                    filters.selectedCategory === cat ? "" : cat,
                })
              }
              className={`px-3 py-1 text-xs rounded-full border transition-colors ${
                filters.selectedCategory === cat
                  ? "bg-accent text-white border-accent"
                  : "border-border text-muted hover:border-accent"
              }`}
            >
              {cat}
            </button>
          ))}
        </div>
      )}

      {/* Tag chips */}
      {tags.length > 0 && (
        <div className="flex flex-wrap gap-1.5 max-h-[120px] overflow-y-auto">
          {tags.slice(0, 30).map((tag) => {
            const active = filters.selectedTags.includes(tag);
            const count = tagCounts.get(tag) ?? 0;
            return (
              <button
                key={tag}
                type="button"
                onClick={() =>
                  set({
                    selectedTags: active
                      ? filters.selectedTags.filter((t) => t !== tag)
                      : [...filters.selectedTags, tag],
                  })
                }
                className={`px-2 py-0.5 text-[11px] border rounded-full transition-colors ${
                  active
                    ? "bg-accent text-white border-accent"
                    : "bg-background text-muted border-border hover:bg-surface"
                }`}
              >
                {tag}
                <span className="opacity-70 ml-1">({count})</span>
              </button>
            );
          })}
          {tags.length > 30 && (
            <span className="text-[10px] text-muted self-center">
              +{tags.length - 30} more
            </span>
          )}
        </div>
      )}
    </div>
  );
}
