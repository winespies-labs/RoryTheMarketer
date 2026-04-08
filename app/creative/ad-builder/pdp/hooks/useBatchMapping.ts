"use client";

import { useMemo, useState, useCallback } from "react";
import {
  resolveBatchMappings,
  type WineAdContext,
  type BatchMappingResult,
} from "../../_shared/wineAdContext";

/**
 * Wraps resolveBatchMappings and exposes per-field override capability.
 * Overrides are local state only — never written back to the feed.
 */
export function useBatchMapping(
  selectedSaleIds: number[],
  selectedTemplateIds: string[],
  contexts: WineAdContext[]
) {
  // { saleId: { fieldKey: overrideValue } } — per-wine, not per wine×template
  const [overrides, setOverrides] = useState<
    Record<number, Record<string, string>>
  >({});

  // Compute batch when selections or contexts change
  const batch = useMemo<BatchMappingResult | null>(() => {
    if (selectedSaleIds.length === 0 || selectedTemplateIds.length === 0) {
      return null;
    }
    const selectedContexts = contexts.filter((c) =>
      selectedSaleIds.includes(c.sale_id)
    );
    return resolveBatchMappings(selectedContexts, selectedTemplateIds);
  }, [selectedSaleIds, selectedTemplateIds, contexts]);

  const setOverride = useCallback(
    (saleId: number, fieldKey: string, value: string) => {
      setOverrides((prev) => ({
        ...prev,
        [saleId]: {
          ...(prev[saleId] ?? {}),
          [fieldKey]: value,
        },
      }));
    },
    []
  );

  const clearOverrides = useCallback(() => {
    setOverrides({});
  }, []);

  // Derived summary
  const readyCount = batch?.ready_count ?? 0;
  const blockedCount = batch?.blocked_count ?? 0;

  const blockedSummary = useMemo(() => {
    if (!batch) return [];
    return batch.mappings
      .filter((m) => m.blocked)
      .map((m) => ({
        wine: m.context.display_name,
        template: m.template.name,
        reasons: m.blocked_reasons,
      }));
  }, [batch]);

  return {
    batch,
    overrides,
    setOverride,
    clearOverrides,
    readyCount,
    blockedCount,
    blockedSummary,
  };
}
