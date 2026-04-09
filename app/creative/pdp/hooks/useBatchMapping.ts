// app/creative/pdp/hooks/useBatchMapping.ts
"use client";

import { useMemo } from "react";
import {
  resolveBatchMappings,
  type BatchMappingResult,
  type WineAdContext,
} from "../../ad-builder/_shared/wineAdContext";

/**
 * Wraps resolveBatchMappings. Re-runs whenever selected wines or template IDs change.
 * Returns null when either list is empty.
 */
export function useBatchMapping(
  contexts: WineAdContext[],
  templateIds: string[]
): BatchMappingResult | null {
  return useMemo(() => {
    if (contexts.length === 0 || templateIds.length === 0) return null;
    return resolveBatchMappings(contexts, templateIds);
  }, [contexts, templateIds]);
}
