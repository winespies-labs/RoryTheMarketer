"use client";

import { useMemo } from "react";
import {
  resolveBatchMappings,
  type BatchMappingResult,
  type WineAdContext,
} from "../../ad-builder/_shared/wineAdContext";

/**
 * Wraps resolveBatchMappings. Re-runs whenever selected wines or styles change.
 * Returns null when either list is empty.
 */
export function useBatchMapping(
  contexts: WineAdContext[],
  styles: { id: string; name: string }[]
): BatchMappingResult | null {
  return useMemo(() => {
    if (contexts.length === 0 || styles.length === 0) return null;
    return resolveBatchMappings(contexts, styles);
  }, [contexts, styles]);
}
