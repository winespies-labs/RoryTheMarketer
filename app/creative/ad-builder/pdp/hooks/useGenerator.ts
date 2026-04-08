"use client";

import { useState, useCallback } from "react";
import { buildCopyPrompt, type BatchMappingResult, type TemplateSchema, type WineAdContext } from "../../_shared/wineAdContext";

export type AdGenerationStatus =
  | "pending"
  | "generating_copy"
  | "generating_image"
  | "complete"
  | "error";

export interface GeneratedAd {
  mapping_key: string;
  context: WineAdContext;
  template: TemplateSchema;
  status: AdGenerationStatus;
  error?: string;

  // Generated (mutable via UI)
  headline: string;
  primary_text: string;
  description: string;
  image_url: string | null;

  // Meta ad fields
  sale_url: string;
  selected: boolean;
}

async function generateCopy(
  context: WineAdContext,
  template: TemplateSchema,
  overrides: Record<string, string> = {}
): Promise<{ headline: string; primary_text: string; description: string }> {
  const prompt = buildCopyPrompt(context, template, {
    tone: "irreverent",
    overrides,
  });

  const res = await fetch("/api/creative/generate-copy", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ prompt }),
  });

  if (!res.ok) throw new Error(`Copy generation failed: ${res.status}`);
  const data = await res.json();
  return data as { headline: string; primary_text: string; description: string };
}

async function saveAdToDb(ad: GeneratedAd, brand = "winespies"): Promise<void> {
  try {
    await fetch("/api/creative/ads", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brandId: brand,
        saleId: ad.context.sale_id,
        templateId: ad.template.id,
        wineName: ad.context.display_name,
        templateName: ad.template.name,
        headline: ad.headline,
        primaryText: ad.primary_text,
        description: ad.description,
        imageUrl: ad.image_url,
        saleUrl: ad.sale_url,
      }),
    });
  } catch {
    // Non-fatal — generation still succeeds without DB save
  }
}

async function generateImage(
  context: WineAdContext,
  template: TemplateSchema,
  overrides: Record<string, string> = {}
): Promise<string | null> {
  const classLabel =
    context.varietal_classification === "red"
      ? "dark red wine"
      : context.varietal_classification === "white"
      ? "crisp white wine"
      : context.varietal_classification === "sparkling"
      ? "sparkling wine"
      : "wine";

  const effectiveScore =
    overrides["score_badge"] != null && overrides["score_badge"] !== ""
      ? overrides["score_badge"]
      : context.has_score && context.score
      ? String(context.score)
      : null;
  const effectiveLabel =
    overrides["score_label"] != null && overrides["score_label"] !== ""
      ? overrides["score_label"]
      : context.has_score
      ? context.score_label
      : null;

  const scoreText = effectiveScore
    ? `Prominently display "${effectiveScore} pts — ${effectiveLabel}" as a score badge.`
    : "";

  const imagePrompt = `
Professional wine advertisement image in ${template.name} style.
Wine: ${context.display_name} (${classLabel}).
Style: dark, dramatic, cinematic — luxury wine imagery.
Feature the wine bottle prominently.
Show sale price ${context.sale_price} (was ${context.retail_price}, ${context.discount_pct}% off) as a price callout overlay.
${scoreText}
High contrast, editorial quality. Square format 1:1.
Do not include any other text beyond the price and score badge.
`.trim();

  try {
    const res = await fetch("/api/creative/generate-image", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        prompt: imagePrompt,
        bottleImageUrl: context.composite_image_url || undefined,
      }),
    });

    if (!res.ok) return null;
    const data = await res.json();
    return data.imageDataUrl ?? null;
  } catch {
    return null;
  }
}

export function useGenerator(
  batch: BatchMappingResult | null,
  overrides: Record<number, Record<string, string>>
) {
  const [ads, setAds] = useState<GeneratedAd[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);

  const updateAdField = useCallback(
    (mappingKey: string, updates: Partial<GeneratedAd>) => {
      setAds((prev) =>
        prev.map((ad) =>
          ad.mapping_key === mappingKey ? { ...ad, ...updates } : ad
        )
      );
    },
    []
  );

  const startGeneration = useCallback(async () => {
    if (!batch || isGenerating) return;

    const readyMappings = batch.mappings.filter((m) => m.ready);
    if (readyMappings.length === 0) return;

    // Initialize all ads as pending
    const initial: GeneratedAd[] = readyMappings.map((m) => ({
      mapping_key: m.mapping_key,
      context: m.context,
      template: m.template,
      status: "pending",
      headline: "",
      primary_text: "",
      description: "",
      image_url: null,
      sale_url: m.context.sale_url,
      selected: true,
    }));

    setAds(initial);
    setIsGenerating(true);

    // Generate all ads in parallel
    await Promise.all(
      readyMappings.map(async (mapping) => {
        const key = mapping.mapping_key;
        const fieldOverrides = overrides[mapping.context.sale_id] ?? {};

        try {
          // Copy generation
          updateAdField(key, { status: "generating_copy" });
          const copy = await generateCopy(
            mapping.context,
            mapping.template,
            fieldOverrides
          );
          updateAdField(key, {
            headline: copy.headline,
            primary_text: copy.primary_text,
            description: copy.description,
            status: "generating_image",
          });

          // Image generation
          const imageUrl = await generateImage(mapping.context, mapping.template, fieldOverrides);
          updateAdField(key, {
            image_url: imageUrl,
            status: "complete",
          });

          // Auto-save to DB (best effort, non-blocking)
          setAds((current) => {
            const saved = current.find((a) => a.mapping_key === key);
            if (saved) {
              saveAdToDb({ ...saved, image_url: imageUrl, status: "complete" });
            }
            return current;
          });
        } catch (err) {
          updateAdField(key, {
            status: "error",
            error: err instanceof Error ? err.message : "Generation failed",
          });
        }
      })
    );

    setIsGenerating(false);
  }, [batch, overrides, isGenerating, updateAdField]);

  const regenerateCopy = useCallback(
    async (mappingKey: string) => {
      const ad = ads.find((a) => a.mapping_key === mappingKey);
      if (!ad) return;
      const fieldOverrides = overrides[ad.context.sale_id] ?? {};

      updateAdField(mappingKey, { status: "generating_copy" });
      try {
        const copy = await generateCopy(ad.context, ad.template, fieldOverrides);
        updateAdField(mappingKey, {
          ...copy,
          status: "complete",
        });
      } catch (err) {
        updateAdField(mappingKey, {
          status: "error",
          error: err instanceof Error ? err.message : "Copy regeneration failed",
        });
      }
    },
    [ads, overrides, updateAdField]
  );

  const regenerateImage = useCallback(
    async (mappingKey: string) => {
      const ad = ads.find((a) => a.mapping_key === mappingKey);
      if (!ad) return;

      updateAdField(mappingKey, { status: "generating_image" });
      const imgOverrides = overrides[ad.context.sale_id] ?? {};
      try {
        const imageUrl = await generateImage(ad.context, ad.template, imgOverrides);
        updateAdField(mappingKey, { image_url: imageUrl, status: "complete" });
      } catch (err) {
        updateAdField(mappingKey, {
          status: "error",
          error: err instanceof Error ? err.message : "Image regeneration failed",
        });
      }
    },
    [ads, updateAdField]
  );

  const updateField = useCallback(
    (
      mappingKey: string,
      field: "headline" | "primary_text" | "description",
      value: string
    ) => {
      updateAdField(mappingKey, { [field]: value });
    },
    [updateAdField]
  );

  const toggleSelected = useCallback(
    (mappingKey: string) => {
      setAds((prev) =>
        prev.map((ad) =>
          ad.mapping_key === mappingKey
            ? { ...ad, selected: !ad.selected }
            : ad
        )
      );
    },
    []
  );

  const progress = {
    completed: ads.filter((a) => a.status === "complete" || a.status === "error")
      .length,
    total: ads.length,
  };

  return {
    ads,
    isGenerating,
    progress,
    startGeneration,
    regenerateCopy,
    regenerateImage,
    updateField,
    toggleSelected,
  };
}
