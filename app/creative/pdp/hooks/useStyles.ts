"use client";

import { useState, useEffect } from "react";

export interface AdStyle {
  id: string;
  name: string;
  addedAt: string;
  imageBase64: string;
  mimeType: string;
}

export function useStyles(brand = "winespies") {
  const [styles, setStyles] = useState<AdStyle[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

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
  }, [brand]);

  return { styles, loading, error };
}
