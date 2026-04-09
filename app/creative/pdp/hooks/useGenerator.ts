"use client";

import { useState, useCallback } from "react";
import type { WineAdContext } from "../../ad-builder/_shared/wineAdContext";

export type JobStatus = "pending" | "generating" | "complete" | "error";

export interface GenerationJob {
  id: string; // `${saleId}:${styleId}`
  saleId: number;
  styleId: string;
  wineName: string;
  styleName: string;
  status: JobStatus;
  imageBase64: string | null;
  mimeType: string;
  error?: string;
}

export interface WineOverrides {
  wineName?: string;
  score?: string;
  pullQuote?: string;
  ctaText?: string;
  salePrice?: string;
  retailPrice?: string;
  bottleImageUrl?: string;
}

function buildWineData(ctx: WineAdContext, overrides: WineOverrides = {}) {
  const wineName =
    overrides.wineName !== undefined && overrides.wineName !== ""
      ? overrides.wineName
      : ctx.display_name;

  // If user explicitly cleared score (""), treat as no score
  const score =
    overrides.score !== undefined
      ? overrides.score || undefined
      : ctx.has_score && ctx.score
      ? `${ctx.score} pts — ${ctx.score_label}`
      : undefined;

  const pullQuote =
    overrides.pullQuote !== undefined
      ? overrides.pullQuote || undefined
      : ctx.mini_brief_plain.slice(0, 220) || undefined;

  const ctaText =
    overrides.ctaText !== undefined && overrides.ctaText !== ""
      ? overrides.ctaText
      : "Shop This Deal →";

  const salePrice =
    overrides.salePrice !== undefined && overrides.salePrice !== ""
      ? overrides.salePrice
      : ctx.sale_price;

  const retailPrice =
    overrides.retailPrice !== undefined && overrides.retailPrice !== ""
      ? overrides.retailPrice
      : ctx.retail_price;

  const bottleImageUrl =
    overrides.bottleImageUrl !== undefined && overrides.bottleImageUrl !== ""
      ? overrides.bottleImageUrl
      : ctx.composite_image_url;

  return {
    headline: wineName,
    score,
    pullQuote,
    salePrice,
    retailPrice,
    ctaText,
    bottleImageUrl,
  };
}

async function callGenerate(
  brand: string,
  styleId: string,
  wineData: ReturnType<typeof buildWineData>,
  fixInstruction?: string
): Promise<{ imageBase64: string; mimeType: string }> {
  const res = await fetch("/api/pdp/generate", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ brand, styleId, wineData, fixInstruction }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({ error: res.statusText })) as { error?: string };
    throw new Error(err.error ?? `HTTP ${res.status}`);
  }
  return res.json() as Promise<{ imageBase64: string; mimeType: string }>;
}

export function useGenerator() {
  const [jobs, setJobs] = useState<GenerationJob[]>([]);
  const [running, setRunning] = useState(false);

  const updateJob = useCallback((id: string, updates: Partial<GenerationJob>) => {
    setJobs((prev) => prev.map((j) => (j.id === id ? { ...j, ...updates } : j)));
  }, []);

  const startBatch = useCallback(
    async (
      contexts: WineAdContext[],
      styles: { id: string; name: string }[],
      overrides: Record<number, WineOverrides>,
      brand = "winespies"
    ) => {
      if (running) return;

      // Build the full job list
      const initial: GenerationJob[] = contexts.flatMap((ctx) =>
        styles.map((style) => ({
          id: `${ctx.sale_id}:${style.id}`,
          saleId: ctx.sale_id,
          styleId: style.id,
          wineName: overrides[ctx.sale_id]?.wineName || ctx.display_name,
          styleName: style.name,
          status: "pending" as JobStatus,
          imageBase64: null,
          mimeType: "image/png",
        }))
      );

      setJobs(initial);
      setRunning(true);

      await Promise.all(
        contexts.flatMap((ctx) =>
          styles.map(async (style) => {
            const jobId = `${ctx.sale_id}:${style.id}`;
            updateJob(jobId, { status: "generating" });
            try {
              const wineData = buildWineData(ctx, overrides[ctx.sale_id]);
              const data = await callGenerate(brand, style.id, wineData);
              updateJob(jobId, { status: "complete", imageBase64: data.imageBase64, mimeType: data.mimeType });
            } catch (err) {
              updateJob(jobId, {
                status: "error",
                error: err instanceof Error ? err.message : "Generation failed",
              });
            }
          })
        )
      );

      setRunning(false);
    },
    [running, updateJob]
  );

  const regenerate = useCallback(
    async (
      jobId: string,
      ctx: WineAdContext,
      style: { id: string; name: string },
      overrides: WineOverrides,
      brand = "winespies",
      fixInstruction?: string
    ) => {
      updateJob(jobId, { status: "generating", error: undefined });
      try {
        const wineData = buildWineData(ctx, overrides);
        const data = await callGenerate(brand, style.id, wineData, fixInstruction);
        updateJob(jobId, { status: "complete", imageBase64: data.imageBase64, mimeType: data.mimeType });
      } catch (err) {
        updateJob(jobId, {
          status: "error",
          error: err instanceof Error ? err.message : "Generation failed",
        });
      }
    },
    [updateJob]
  );

  const progress = {
    total: jobs.length,
    complete: jobs.filter((j) => j.status === "complete").length,
    error: jobs.filter((j) => j.status === "error").length,
    generating: jobs.filter((j) => j.status === "generating").length,
  };

  return { jobs, running, progress, startBatch, regenerate };
}
