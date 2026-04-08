"use client";

import Image from "next/image";
import type { WineAdContext, VarietalClassification } from "../../ad-builder/_shared/wineAdContext";
import type { ChannelFilter, ClassificationFilter } from "../hooks/useFeed";

const CLASSIFICATION_OPTIONS: { value: VarietalClassification; label: string }[] = [
  { value: "red", label: "Red" },
  { value: "white", label: "White" },
  { value: "rosé", label: "Rosé" },
  { value: "sparkling", label: "Sparkling" },
  { value: "dessert", label: "Dessert" },
];

function WineCard({
  context,
  selected,
  onToggle,
}: {
  context: WineAdContext;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative w-full text-left rounded-xl border transition-all ${
        context.sold_out ? "opacity-60" : ""
      } ${
        selected
          ? "border-accent bg-accent/5 ring-1 ring-accent"
          : "border-border bg-surface hover:border-border/80"
      }`}
    >
      {context.sold_out && (
        <div className="absolute top-2 left-2 z-10">
          <span className="text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded bg-danger/10 text-danger">
            Sold Out
          </span>
        </div>
      )}

      <div
        className={`absolute top-2 right-2 z-10 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
          selected ? "border-accent bg-accent" : "border-border bg-surface"
        }`}
      >
        {selected && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>

      <div className="p-3 flex gap-3">
        <div className="w-14 h-20 shrink-0 relative rounded overflow-hidden bg-background">
          {context.composite_image_url ? (
            <Image
              src={context.composite_image_url}
              alt={context.display_name}
              fill
              className="object-contain"
              sizes="56px"
            />
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted/40">
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
              </svg>
            </div>
          )}
        </div>

        <div className="flex-1 min-w-0 pt-1">
          <div className="flex items-center gap-1.5 mb-1 flex-wrap">
            <span
              className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${
                context.channel === "featured"
                  ? "bg-amber-100 text-amber-700"
                  : "bg-background text-muted border border-border"
              }`}
            >
              {context.channel === "featured" ? "Featured" : "Store"}
            </span>
            {context.has_score && context.score && (
              <span className="text-xs font-bold text-foreground">
                {context.score}{" "}
                <span className="text-[10px] text-muted font-normal">{context.score_label}</span>
              </span>
            )}
          </div>

          <div className="text-[11px] text-muted font-medium mb-0.5">{context.producer}</div>
          <div className="text-sm font-semibold text-foreground leading-tight line-clamp-2">
            {context.vintage} {context.wine_name}
          </div>
          <div className="text-[11px] text-muted mt-0.5">
            {context.varietal} · {context.appellation}
          </div>

          <div className="mt-2 flex items-baseline gap-1.5">
            <span className="text-base font-bold text-foreground">{context.sale_price}</span>
            <span className="text-xs text-muted line-through">{context.retail_price}</span>
            <span className="text-xs font-semibold text-success">{context.discount_pct}% off</span>
          </div>

          {context.qty_remaining > 0 && context.qty_remaining <= 12 && (
            <div className="text-[10px] text-danger mt-0.5 font-medium">
              {context.qty_remaining} left
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

interface WineSelectorProps {
  filtered: WineAdContext[];
  loading: boolean;
  error: string | null;
  selected: number[];
  onToggle: (id: number) => void;
  onSelectAll: () => void;
  onClearSelection: () => void;
  channelFilter: ChannelFilter;
  classificationFilter: ClassificationFilter;
  inStockOnly: boolean;
  search: string;
  onChannelFilter: (v: ChannelFilter) => void;
  onClassificationFilter: (v: ClassificationFilter) => void;
  onInStockOnly: (v: boolean) => void;
  onSearch: (v: string) => void;
  onNext: () => void;
}

export default function WineSelector({
  filtered,
  loading,
  error,
  selected,
  onToggle,
  onSelectAll,
  onClearSelection,
  channelFilter,
  classificationFilter,
  inStockOnly,
  search,
  onChannelFilter,
  onClassificationFilter,
  onInStockOnly,
  onSearch,
  onNext,
}: WineSelectorProps) {
  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Select Wines</h2>
          <p className="text-sm text-muted mt-0.5">
            Choose wines from today&apos;s live feed to generate ads for.
          </p>
        </div>
        <div className="flex items-center gap-3">
          {selected.length > 0 && (
            <span className="text-sm font-medium text-accent">{selected.length} selected</span>
          )}
          <button
            onClick={onNext}
            disabled={selected.length === 0}
            className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent/90 transition-colors"
          >
            Next →
          </button>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap items-center gap-2">
        <div className="relative">
          <svg className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
          <input
            type="text"
            value={search}
            onChange={(e) => onSearch(e.target.value)}
            placeholder="Search wines…"
            className="pl-8 pr-3 py-1.5 text-sm border border-border rounded-lg bg-surface focus:outline-none focus:ring-1 focus:ring-accent w-48"
          />
        </div>

        <div className="flex rounded-lg border border-border overflow-hidden text-sm">
          {([{ value: null, label: "All" }, { value: "featured", label: "Featured" }, { value: "store", label: "Store" }] as { value: ChannelFilter; label: string }[]).map((opt) => (
            <button
              key={String(opt.value)}
              onClick={() => onChannelFilter(opt.value)}
              className={`px-3 py-1.5 transition-colors ${channelFilter === opt.value ? "bg-accent text-white font-medium" : "bg-surface text-muted hover:text-foreground"}`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <div className="flex rounded-lg border border-border overflow-hidden text-sm">
          <button
            onClick={() => onClassificationFilter(null)}
            className={`px-3 py-1.5 transition-colors ${classificationFilter === null ? "bg-accent text-white font-medium" : "bg-surface text-muted hover:text-foreground"}`}
          >
            All
          </button>
          {CLASSIFICATION_OPTIONS.map((opt) => (
            <button
              key={opt.value}
              onClick={() => onClassificationFilter(opt.value)}
              className={`px-3 py-1.5 transition-colors ${classificationFilter === opt.value ? "bg-accent text-white font-medium" : "bg-surface text-muted hover:text-foreground"}`}
            >
              {opt.label}
            </button>
          ))}
        </div>

        <label className="flex items-center gap-1.5 text-sm text-muted cursor-pointer">
          <input type="checkbox" checked={inStockOnly} onChange={(e) => onInStockOnly(e.target.checked)} className="rounded" />
          In stock only
        </label>

        <div className="ml-auto flex gap-2">
          <button onClick={onSelectAll} className="text-sm text-accent hover:underline">
            Select all
          </button>
          {selected.length > 0 && (
            <button onClick={onClearSelection} className="text-sm text-muted hover:text-foreground">
              Clear
            </button>
          )}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center py-16 text-muted text-sm">Loading feed…</div>
      )}
      {error && (
        <div className="rounded-lg bg-danger/10 border border-danger/20 p-4 text-sm text-danger">{error}</div>
      )}
      {!loading && !error && filtered.length === 0 && (
        <div className="text-center py-16 text-muted text-sm">No wines match your filters.</div>
      )}
      {!loading && !error && filtered.length > 0 && (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((ctx) => (
            <WineCard
              key={ctx.sale_id}
              context={ctx}
              selected={selected.includes(ctx.sale_id)}
              onToggle={() => onToggle(ctx.sale_id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
