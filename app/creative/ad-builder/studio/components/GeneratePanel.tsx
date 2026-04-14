// app/creative/ad-builder/studio/components/GeneratePanel.tsx
"use client";

import { useState } from "react";
import type { StudioStyle } from "../hooks/useStudioStyles";
import type { ContentTokens } from "./ContentConfigurator";

export interface GeneratedImage {
  base64: string;
  mimeType: string;
}

export default function GeneratePanel({
  style,
  tokens,
  onBack,
  onGenerated,
}: {
  style: StudioStyle;
  tokens: ContentTokens;
  onBack: () => void;
  onGenerated: (images: GeneratedImage[]) => void;
}) {
  const [images, setImages] = useState<GeneratedImage[]>([]);
  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setGenerating(true);
    setError(null);

    // Build token map from ContentTokens (omit empty strings)
    const tokenMap: Record<string, string> = {};
    for (const [k, v] of Object.entries(tokens)) {
      if (v) tokenMap[k] = v;
    }

    try {
      const res = await fetch("/api/studio/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ styleId: style.id, tokens: tokenMap }),
      });
      const data = await res.json() as { images?: GeneratedImage[]; error?: string };
      if (!res.ok) throw new Error(data.error ?? "Generation failed");
      const imgs = data.images ?? [];
      setImages(imgs);
      onGenerated(imgs);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    }
    setGenerating(false);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Generate</h2>
          <p className="text-xs text-muted mt-0.5">Style: <span className="font-medium text-foreground">{style.label}</span></p>
        </div>
        <button type="button" onClick={onBack} className="text-sm text-muted hover:text-foreground">
          ← Back
        </button>
      </div>

      {/* Token summary */}
      <div className="p-3 rounded-lg bg-surface border border-border text-xs space-y-1">
        {tokens.headline && <p><span className="text-muted">Headline:</span> {tokens.headline}</p>}
        {tokens.ctaText && <p><span className="text-muted">CTA:</span> {tokens.ctaText}</p>}
        {tokens.reviewerName && <p><span className="text-muted">Reviewer:</span> {tokens.reviewerName}</p>}
      </div>

      {/* Generate button */}
      {images.length === 0 && (
        <button
          type="button"
          onClick={generate}
          disabled={generating}
          className="w-full py-3 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 transition-colors font-medium"
        >
          {generating ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              Generating...
            </span>
          ) : "Generate Ad"}
        </button>
      )}

      {error && <p className="text-sm text-danger">{error}</p>}

      {/* Generated images */}
      {images.length > 0 && (
        <div className="flex flex-col gap-4">
          <div className={`grid gap-3 ${images.length > 1 ? "grid-cols-2" : "grid-cols-1"}`}>
            {images.map((img, i) => (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                key={i}
                src={`data:${img.mimeType};base64,${img.base64}`}
                alt={`Generated ad ${i + 1}`}
                className="w-full rounded-xl border border-border"
              />
            ))}
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={generate}
              disabled={generating}
              className="flex-1 py-2.5 text-sm border border-border rounded-lg hover:border-accent transition-colors disabled:opacity-50"
            >
              {generating ? "Regenerating..." : "Regenerate"}
            </button>
            <button
              type="button"
              onClick={() => onGenerated(images)}
              className="flex-1 py-2.5 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors font-medium"
            >
              Continue →
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
