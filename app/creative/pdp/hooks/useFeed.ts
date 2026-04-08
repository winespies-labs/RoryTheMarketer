"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import {
  resolveWineAdContext,
  type RawSale,
  type WineAdContext,
  type VarietalClassification,
} from "../../ad-builder/_shared/wineAdContext";

export type ChannelFilter = "featured" | "store" | null;
export type ClassificationFilter = VarietalClassification | null;

interface FeedState {
  sales: RawSale[];
  loading: boolean;
  error: string | null;
  loadedAt: number | null;
}

const REFETCH_AFTER_MS = 10 * 60 * 1000;

export function useFeed() {
  const [state, setState] = useState<FeedState>({
    sales: [],
    loading: false,
    error: null,
    loadedAt: null,
  });

  const [channelFilter, setChannelFilter] = useState<ChannelFilter>(null);
  const [classificationFilter, setClassificationFilter] = useState<ClassificationFilter>(null);
  const [inStockOnly, setInStockOnly] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<number[]>([]);

  const fetchFeed = useCallback(async () => {
    setState((s) => ({ ...s, loading: true, error: null }));
    try {
      const res = await fetch("/api/wines/current");
      if (!res.ok) throw new Error(`Feed returned ${res.status}`);
      const data = (await res.json()) as RawSale[];
      setState({ sales: data, loading: false, error: null, loadedAt: Date.now() });
    } catch (err) {
      setState((s) => ({
        ...s,
        loading: false,
        error: err instanceof Error ? err.message : "Failed to fetch feed",
      }));
    }
  }, []);

  useEffect(() => {
    const stale = !state.loadedAt || Date.now() - state.loadedAt > REFETCH_AFTER_MS;
    if (stale && !state.loading) fetchFeed();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const contexts = useMemo<WineAdContext[]>(
    () => state.sales.map((s) => resolveWineAdContext(s)),
    [state.sales]
  );

  const filtered = useMemo<WineAdContext[]>(() => {
    let list = contexts;
    if (channelFilter) list = list.filter((c) => c.channel === channelFilter);
    if (classificationFilter) list = list.filter((c) => c.varietal_classification === classificationFilter);
    if (inStockOnly) list = list.filter((c) => !c.sold_out);
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (c) =>
          c.display_name.toLowerCase().includes(q) ||
          c.producer.toLowerCase().includes(q) ||
          c.varietal.toLowerCase().includes(q)
      );
    }
    return list;
  }, [contexts, channelFilter, classificationFilter, inStockOnly, search]);

  const toggleSelect = useCallback((id: number) => {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }, []);

  const selectAll = useCallback(() => {
    setSelected(filtered.map((c) => c.sale_id));
  }, [filtered]);

  const clearSelection = useCallback(() => setSelected([]), []);

  const selectedContexts = useMemo(
    () => contexts.filter((c) => selected.includes(c.sale_id)),
    [contexts, selected]
  );

  return {
    contexts,
    filtered,
    loading: state.loading,
    error: state.error,
    refresh: fetchFeed,
    channelFilter,
    classificationFilter,
    inStockOnly,
    search,
    setChannelFilter,
    setClassificationFilter,
    setInStockOnly,
    setSearch,
    selected,
    selectedContexts,
    toggleSelect,
    selectAll,
    clearSelection,
  };
}
