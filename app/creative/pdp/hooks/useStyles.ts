"use client";

import { useState, useEffect, useCallback } from "react";

export interface AdStyle {
  id: string;
  name: string;
  imageBase64: string;
  mimeType: string;
}

export function useStyles(brand = "winespies") {
  const [styles, setStyles] = useState<AdStyle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  useEffect(() => {
    setLoading(true);
    fetch(`/api/pdp/styles?brand=${brand}`)
      .then((r) => {
        if (!r.ok) throw new Error(`Styles fetch failed: ${r.status}`);
        return r.json();
      })
      .then((data) => {
        setStyles(data as AdStyle[]);
        setLoading(false);
      })
      .catch((err: unknown) => {
        setError(err instanceof Error ? err.message : "Failed to load styles");
        setLoading(false);
      });
  }, [brand, refreshKey]);

  return { styles, loading, error, refresh };
}
