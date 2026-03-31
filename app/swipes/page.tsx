"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import {
  type UnifiedSwipe,
  type SwipeSource,
  type ExtractedSwipe,
  normalizeLibraryItems,
  normalizeDrills,
  normalizeExtractedSwipes,
  getLibraryId,
} from "@/lib/unified-swipe";
import { TECHNIQUES } from "@/lib/copy-drill-data";
import SwipeGrid from "./components/SwipeGrid";
import SwipeFilters, { type SwipeFilterState } from "./components/SwipeFilters";
import SwipeModal from "./components/SwipeModal";
import AddSwipePanel from "./components/AddSwipePanel";
import ExtractSwipesPanel from "./components/ExtractSwipesPanel";

const BRAND_ID = "winespies";
const SWIPE_TYPES = ["swipe", "copywriting", "ad_copy"] as const;
type SwipeType = (typeof SWIPE_TYPES)[number];

export default function SwipesPage() {
  const [libraryItems, setLibraryItems] = useState<UnifiedSwipe[]>([]);
  const [extractedItems, setExtractedItems] = useState<UnifiedSwipe[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalSwipe, setModalSwipe] = useState<UnifiedSwipe | null>(null);

  const [filters, setFilters] = useState<SwipeFilterState>({
    q: "",
    source: "",
    starredOnly: false,
    selectedCategory: "",
    selectedTags: [],
  });

  // Static drills — computed once
  const drillItems = useMemo(() => normalizeDrills(TECHNIQUES), []);

  const fetchLibrary = useCallback(() => {
    const params = new URLSearchParams({ brand: BRAND_ID });
    return fetch(`/api/context-library?${params.toString()}`)
      .then((r) => r.json())
      .then((d) => {
        const items = (d.items ?? []).filter((i: { type: string }) =>
          SWIPE_TYPES.includes(i.type as SwipeType)
        );
        setLibraryItems(normalizeLibraryItems(items));
      })
      .catch(() => setLibraryItems([]));
  }, []);

  const fetchExtracted = useCallback(() => {
    return fetch("/api/swipe-analysis/swipes")
      .then((r) => r.json())
      .then((data) => {
        setExtractedItems(
          normalizeExtractedSwipes((data.swipes || []) as ExtractedSwipe[])
        );
      })
      .catch(() => setExtractedItems([]));
  }, []);

  const fetchAll = useCallback(() => {
    setLoading(true);
    Promise.all([fetchLibrary(), fetchExtracted()]).finally(() =>
      setLoading(false)
    );
  }, [fetchLibrary, fetchExtracted]);

  useEffect(() => {
    fetchAll();
  }, [fetchAll]);

  // Combine all sources
  const allSwipes = useMemo(
    () => [...libraryItems, ...drillItems, ...extractedItems],
    [libraryItems, drillItems, extractedItems]
  );

  // Derive categories and tags from all swipes
  const categories = useMemo(() => {
    const cats = new Set<string>();
    for (const s of allSwipes) {
      if (s.category && s.category !== "Uncategorized") cats.add(s.category);
    }
    return [...cats].sort();
  }, [allSwipes]);

  const tagCounts = useMemo(() => {
    const m = new Map<string, number>();
    for (const s of allSwipes) {
      for (const t of s.tags) {
        m.set(t, (m.get(t) ?? 0) + 1);
      }
    }
    return m;
  }, [allSwipes]);

  const sortedTags = useMemo(
    () =>
      [...tagCounts.entries()]
        .sort((a, b) => b[1] - a[1])
        .map(([t]) => t),
    [tagCounts]
  );

  // Apply filters
  const displaySwipes = useMemo(() => {
    let out = allSwipes;

    // Source filter
    if (filters.source) {
      out = out.filter((s) => s.source === filters.source);
    }

    // Starred
    if (filters.starredOnly) {
      out = out.filter((s) => s.starred);
    }

    // Category
    if (filters.selectedCategory) {
      out = out.filter((s) => s.category === filters.selectedCategory);
    }

    // Tags (any match)
    if (filters.selectedTags.length > 0) {
      out = out.filter((s) =>
        filters.selectedTags.some((t) => s.tags.includes(t))
      );
    }

    // Search
    if (filters.q.trim()) {
      const needle = filters.q.trim().toLowerCase();
      out = out.filter(
        (s) =>
          s.title.toLowerCase().includes(needle) ||
          s.content.toLowerCase().includes(needle) ||
          s.category.toLowerCase().includes(needle) ||
          s.tags.some((t) => t.toLowerCase().includes(needle))
      );
    }

    return out;
  }, [allSwipes, filters]);

  const toggleStar = async (swipe: UnifiedSwipe) => {
    const libraryId = getLibraryId(swipe);
    if (!libraryId) return;
    const meta = {
      ...(swipe.libraryMeta ?? {}),
      starred: !swipe.starred,
    };
    const res = await fetch("/api/context-library", {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brand: BRAND_ID, id: libraryId, meta }),
    });
    if (res.ok) fetchLibrary();
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight mb-1">Swipes</h1>
      <p className="text-muted mb-6">
        Browse, analyze, and drill on swipes from all sources.
      </p>

      {/* Action buttons row */}
      <div className="flex gap-2 flex-wrap mb-6">
        <AddSwipePanel onAdded={fetchLibrary} />
        <ExtractSwipesPanel onExtracted={fetchAll} />
      </div>

      {/* Filters */}
      <SwipeFilters
        filters={filters}
        onChange={setFilters}
        categories={categories}
        tags={sortedTags}
        tagCounts={tagCounts}
      />

      {/* Count */}
      {!loading && (
        <p className="text-xs text-muted mb-3">
          {displaySwipes.length} swipe{displaySwipes.length !== 1 ? "s" : ""}
          {filters.source || filters.starredOnly || filters.selectedCategory || filters.selectedTags.length > 0 || filters.q
            ? ` (filtered from ${allSwipes.length})`
            : ""}
        </p>
      )}

      {/* Grid */}
      <SwipeGrid
        swipes={displaySwipes}
        loading={loading}
        onSelect={setModalSwipe}
        onToggleStar={toggleStar}
      />

      {/* Modal */}
      {modalSwipe && (
        <SwipeModal
          swipe={modalSwipe}
          onClose={() => setModalSwipe(null)}
          onRefresh={fetchAll}
        />
      )}
    </div>
  );
}
