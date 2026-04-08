"use client";

import Image from "next/image";
import type { WineAdContext } from "../../ad-builder/_shared/wineAdContext";
import type { WineOverrides } from "../hooks/useGenerator";

function WineDataRow({
  context,
  overrides,
  onOverride,
}: {
  context: WineAdContext;
  overrides: WineOverrides;
  onOverride: (field: keyof WineOverrides, value: string) => void;
}) {
  const defaultScore =
    context.has_score && context.score
      ? `${context.score} pts — ${context.score_label}`
      : "";

  const wineName =
    overrides.wineName !== undefined ? overrides.wineName : context.display_name;
  const score =
    overrides.score !== undefined ? overrides.score : defaultScore;
  const pullQuote =
    overrides.pullQuote !== undefined
      ? overrides.pullQuote
      : context.mini_brief_plain.slice(0, 220);

  const scoreEmpty = !score;

  return (
    <div className="border border-border rounded-xl p-4 flex gap-4">
      {/* Bottle thumbnail */}
      <div className="w-16 h-24 shrink-0 relative rounded overflow-hidden bg-background">
        {context.composite_image_url ? (
          <Image
            src={context.composite_image_url}
            alt={context.display_name}
            fill
            className="object-contain"
            sizes="64px"
          />
        ) : (
          <div className="w-full h-full bg-muted/10 rounded" />
        )}
      </div>

      {/* Editable fields */}
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-3 min-w-0">
        {/* Wine name */}
        <div className="md:col-span-2">
          <label className="text-[10px] font-semibold text-muted uppercase tracking-wide block mb-1">
            Wine Name / Headline
          </label>
          <input
            type="text"
            value={wineName}
            onChange={(e) => onOverride("wineName", e.target.value)}
            className="w-full px-2.5 py-1.5 text-sm border border-border rounded-lg bg-surface focus:outline-none focus:ring-1 focus:ring-accent"
          />
        </div>

        {/* Score */}
        <div>
          <label className="text-[10px] font-semibold text-muted uppercase tracking-wide block mb-1">
            Score{" "}
            {!context.has_score && (
              <span className="text-amber-500 normal-case font-normal">(not detected — add manually)</span>
            )}
          </label>
          <input
            type="text"
            value={score}
            onChange={(e) => onOverride("score", e.target.value)}
            placeholder="e.g. 95 pts — Wine Spectator"
            className={`w-full px-2.5 py-1.5 text-sm border rounded-lg bg-surface focus:outline-none focus:ring-1 focus:ring-accent ${
              scoreEmpty
                ? "border-amber-300 placeholder-amber-400"
                : "border-border"
            }`}
          />
        </div>

        {/* Pricing (read-only) */}
        <div>
          <label className="text-[10px] font-semibold text-muted uppercase tracking-wide block mb-1">
            Pricing
          </label>
          <div className="flex items-center gap-2 px-2.5 py-1.5 border border-border rounded-lg bg-background/50">
            <span className="text-sm font-bold text-foreground">{context.sale_price}</span>
            <span className="text-sm text-muted line-through">{context.retail_price}</span>
            <span className="text-xs font-semibold text-success">{context.discount_pct}% off</span>
          </div>
        </div>

        {/* Pull quote / body copy */}
        <div className="md:col-span-2">
          <label className="text-[10px] font-semibold text-muted uppercase tracking-wide block mb-1">
            Body Copy
          </label>
          <textarea
            value={pullQuote}
            onChange={(e) => onOverride("pullQuote", e.target.value)}
            rows={2}
            className="w-full px-2.5 py-1.5 text-sm border border-border rounded-lg bg-surface focus:outline-none focus:ring-1 focus:ring-accent resize-none"
          />
        </div>
      </div>
    </div>
  );
}

interface DataReviewProps {
  contexts: WineAdContext[];
  selectedStyles: { id: string; name: string }[];
  overrides: Record<number, WineOverrides>;
  onOverride: (saleId: number, field: keyof WineOverrides, value: string) => void;
  onBack: () => void;
  onGenerate: () => void;
}

export default function DataReview({
  contexts,
  selectedStyles,
  overrides,
  onOverride,
  onBack,
  onGenerate,
}: DataReviewProps) {
  const totalAds = contexts.length * selectedStyles.length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Review Wine Data</h2>
          <p className="text-sm text-muted mt-0.5">
            This is exactly what Gemini will receive. Edit anything before generating — score fields especially.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onBack}
            className="px-3 py-2 text-sm text-muted hover:text-foreground transition-colors"
          >
            ← Back
          </button>
          <button
            onClick={onGenerate}
            className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors"
          >
            Generate {totalAds} Ad{totalAds !== 1 ? "s" : ""} →
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface px-4 py-3 text-sm text-muted">
        <span className="font-medium text-foreground">{contexts.length} wine{contexts.length !== 1 ? "s" : ""}</span>
        {" × "}
        <span className="font-medium text-foreground">{selectedStyles.length} style{selectedStyles.length !== 1 ? "s" : ""}</span>
        {" = "}
        <span className="font-bold text-accent">{totalAds} ads</span>
        <span className="ml-2 text-xs">
          ({selectedStyles.map((s) => s.name).join(", ")})
        </span>
      </div>

      <div className="flex flex-col gap-3">
        {contexts.map((ctx) => (
          <WineDataRow
            key={ctx.sale_id}
            context={ctx}
            overrides={overrides[ctx.sale_id] ?? {}}
            onOverride={(field, value) => onOverride(ctx.sale_id, field, value)}
          />
        ))}
      </div>
    </div>
  );
}
