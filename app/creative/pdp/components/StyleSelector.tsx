"use client";

import type { AdStyle } from "../hooks/useStyles";

function StyleCard({
  style,
  selected,
  onToggle,
}: {
  style: AdStyle;
  selected: boolean;
  onToggle: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onToggle}
      className={`relative w-full text-left rounded-xl border transition-all ${
        selected
          ? "border-accent bg-accent/5 ring-1 ring-accent"
          : "border-border bg-surface hover:border-border/80"
      }`}
    >
      <div
        className={`absolute top-2 right-2 z-10 w-5 h-5 rounded-full border-2 flex items-center justify-center ${
          selected ? "border-accent bg-accent" : "border-border bg-surface"
        }`}
      >
        {selected && (
          <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        )}
      </div>

      <div className="w-full aspect-square rounded-t-xl overflow-hidden bg-background">
        {style.imageBase64 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`data:${style.mimeType};base64,${style.imageBase64}`}
            alt={style.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted/40">
            <svg className="w-10 h-10" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
            </svg>
          </div>
        )}
      </div>

      <div className="p-3">
        <div className="text-sm font-semibold text-foreground">{style.name}</div>
      </div>
    </button>
  );
}

interface StyleSelectorProps {
  styles: AdStyle[];
  loading: boolean;
  error: string | null;
  selected: string[];
  onToggle: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
  selectedWineCount: number;
}

export default function StyleSelector({
  styles,
  loading,
  error,
  selected,
  onToggle,
  onBack,
  onNext,
  selectedWineCount,
}: StyleSelectorProps) {
  const totalAds = selectedWineCount * selected.length;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Select Styles</h2>
          <p className="text-sm text-muted mt-0.5">
            Each style is a reference ad — Gemini matches its layout and aesthetic with your wine&apos;s data.
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button onClick={onBack} className="px-3 py-2 text-sm text-muted hover:text-foreground transition-colors">
            ← Back
          </button>
          <button
            onClick={onNext}
            disabled={selected.length === 0}
            className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent/90 transition-colors"
          >
            Next →
          </button>
        </div>
      </div>

      {selected.length > 0 && (
        <div className="rounded-lg border border-border bg-surface px-4 py-3 text-sm">
          <span className="font-medium text-foreground">
            {selectedWineCount} wine{selectedWineCount !== 1 ? "s" : ""} ×{" "}
            {selected.length} style{selected.length !== 1 ? "s" : ""} ={" "}
            <span className="text-accent font-bold">{totalAds} ads</span>
          </span>
        </div>
      )}

      {loading && (
        <div className="flex items-center justify-center py-16 text-muted text-sm">Loading styles…</div>
      )}
      {error && (
        <div className="rounded-lg bg-danger/10 border border-danger/20 p-4 text-sm text-danger">{error}</div>
      )}
      {!loading && !error && styles.length === 0 && (
        <div className="text-center py-16 text-muted text-sm">
          No styles found. Add reference ads in the Ad Builder first.
        </div>
      )}
      {!loading && !error && styles.length > 0 && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {styles.map((style) => (
            <StyleCard
              key={style.id}
              style={style}
              selected={selected.includes(style.id)}
              onToggle={() => onToggle(style.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
