"use client";

import type { UnifiedSwipe } from "@/lib/unified-swipe";
import SwipeCard from "./SwipeCard";

export default function SwipeGrid({
  swipes,
  loading,
  onSelect,
  onToggleStar,
}: {
  swipes: UnifiedSwipe[];
  loading: boolean;
  onSelect: (s: UnifiedSwipe) => void;
  onToggleStar?: (s: UnifiedSwipe) => void;
}) {
  if (loading) {
    return <p className="text-sm text-muted py-8 text-center">Loading swipes...</p>;
  }

  if (swipes.length === 0) {
    return (
      <p className="text-sm text-muted py-8 text-center">
        No swipes match your filters. Try adjusting your search or filters.
      </p>
    );
  }

  return (
    <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
      {swipes.map((s) => (
        <SwipeCard
          key={s.id}
          swipe={s}
          onSelect={onSelect}
          onToggleStar={onToggleStar}
        />
      ))}
    </div>
  );
}
