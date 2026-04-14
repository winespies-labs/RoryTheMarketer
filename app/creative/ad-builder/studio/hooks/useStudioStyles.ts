// app/creative/ad-builder/studio/hooks/useStudioStyles.ts
"use client";

import { useState, useEffect, useCallback } from "react";

const STUDIO_TYPES = new Set(["usp", "testimonial", "lifestyle", "offer", "ugc", "comparison"]);

export interface StudioStyle {
  id: string;
  label: string;
  angle: string | null;
  nanoBanana: string | null;
  imageFile: string | null;
  type: string | null;
  aspectRatio: string | null;
  notes: string | null;
}

export function useStudioStyles(brand = "winespies") {
  const [styles, setStyles] = useState<StudioStyle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [unregisteredCount, setUnregisteredCount] = useState(0);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    setLoading(true);
    setError(null);

    Promise.all([
      fetch(`/api/ad-reference/list?brand=${brand}`).then((r) => {
        if (!r.ok) throw new Error(`List fetch failed: ${r.status}`);
        return r.json() as Promise<{ referenceAds: StudioStyle[] }>;
      }),
      fetch(`/api/ad-reference/batch-ingest`).then((r) => {
        if (!r.ok) return { unregistered: [] };
        return r.json() as Promise<{ unregistered: string[] }>;
      }),
    ])
      .then(([listData, batchData]) => {
        const all = listData.referenceAds ?? [];
        const filtered = all.filter(
          (a) => !a.type || STUDIO_TYPES.has(a.type)
        );
        setStyles(filtered);
        setUnregisteredCount(batchData.unregistered?.length ?? 0);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load styles");
        setLoading(false);
      });
  }, [brand, refreshKey]);

  return { styles, loading, error, unregisteredCount, refresh };
}
