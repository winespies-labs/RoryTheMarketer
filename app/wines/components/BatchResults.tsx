"use client";

import Image from "next/image";

export type GeneratedAdResult = {
  id: string;
  wineName: string;
  saleId: number;
  mode: "basic" | "templated";
  copyVariation: {
    primaryText: string;
    headline: string;
    description: string;
  };
  imageBase64: string;
  imageMimeType: string;
  destinationUrl: string;
  referenceId?: string;
  selected: boolean;
};

type Props = {
  results: GeneratedAdResult[];
  onUpdateResult: (id: string, updates: Partial<GeneratedAdResult>) => void;
  onToggleSelect: (id: string) => void;
  onToggleAll: (selected: boolean) => void;
  onPublish: () => void;
  onBack: () => void;
};

export default function BatchResults({
  results,
  onUpdateResult,
  onToggleSelect,
  onToggleAll,
  onPublish,
  onBack,
}: Props) {
  const selectedCount = results.filter((r) => r.selected).length;
  const allSelected = selectedCount === results.length;

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="border-b border-border px-4 py-3 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => onToggleAll(!allSelected)}
            className="text-xs text-accent hover:underline"
          >
            {allSelected ? "Deselect All" : "Select All"}
          </button>
          <span className="text-sm text-muted">
            {selectedCount} of {results.length} selected for publishing
          </span>
        </div>
      </div>

      {/* Results list — compact horizontal rows */}
      <div className="flex-1 overflow-y-auto divide-y divide-border">
        {results.map((ad) => (
          <AdResultRow
            key={ad.id}
            ad={ad}
            onToggle={() => onToggleSelect(ad.id)}
            onUpdate={(updates) => onUpdateResult(ad.id, updates)}
          />
        ))}
      </div>

      {/* Footer */}
      <div className="border-t border-border p-4 flex justify-between items-center shrink-0">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-background transition-colors"
        >
          Back
        </button>
        <button
          type="button"
          disabled={selectedCount === 0}
          onClick={onPublish}
          className="px-6 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Publish {selectedCount} Ad{selectedCount !== 1 ? "s" : ""} to Meta
        </button>
      </div>
    </div>
  );
}

function AdResultRow({
  ad,
  onToggle,
  onUpdate,
}: {
  ad: GeneratedAdResult;
  onToggle: () => void;
  onUpdate: (updates: Partial<GeneratedAdResult>) => void;
}) {
  const handleCopyChange = (
    field: "primaryText" | "headline" | "description",
    value: string,
  ) => {
    onUpdate({
      copyVariation: { ...ad.copyVariation, [field]: value },
    });
  };

  return (
    <div
      className={`flex gap-4 p-4 transition-colors ${
        ad.selected ? "bg-surface" : "bg-surface/50 opacity-60"
      }`}
    >
      {/* Checkbox */}
      <div className="shrink-0 pt-1">
        <button
          type="button"
          onClick={onToggle}
          className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
            ad.selected
              ? "bg-accent border-accent"
              : "bg-white border-gray-400 hover:border-accent"
          }`}
        >
          {ad.selected && (
            <svg
              className="w-3 h-3 text-white"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={3}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </button>
      </div>

      {/* Thumbnail */}
      <div className="shrink-0 w-20 h-20 relative rounded-lg overflow-hidden bg-background border border-border">
        {ad.imageBase64 ? (
          <Image
            src={`data:${ad.imageMimeType};base64,${ad.imageBase64}`}
            alt={ad.wineName}
            fill
            className="object-contain"
            sizes="80px"
            unoptimized
          />
        ) : (
          <div className="flex items-center justify-center h-full text-muted text-[10px]">
            No image
          </div>
        )}
      </div>

      {/* Copy fields — always editable */}
      <div className="flex-1 min-w-0 space-y-1.5">
        {/* Wine name + mode badge */}
        <div className="flex items-center gap-2">
          <span className="text-xs font-semibold text-foreground truncate">
            {ad.wineName}
          </span>
          <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-black/10 text-muted shrink-0">
            {ad.mode}
          </span>
        </div>

        {/* Headline */}
        <div>
          <label className="text-[10px] text-muted uppercase tracking-wider">
            Headline
          </label>
          <input
            value={ad.copyVariation.headline}
            onChange={(e) => handleCopyChange("headline", e.target.value)}
            className="w-full px-2 py-1 text-xs border border-border rounded bg-background focus:border-accent focus:outline-none"
          />
        </div>

        {/* Primary Text */}
        <div>
          <label className="text-[10px] text-muted uppercase tracking-wider">
            Primary Text
          </label>
          <textarea
            value={ad.copyVariation.primaryText}
            onChange={(e) => handleCopyChange("primaryText", e.target.value)}
            rows={2}
            className="w-full px-2 py-1 text-xs border border-border rounded bg-background focus:border-accent focus:outline-none resize-none"
          />
        </div>

        {/* Description */}
        <div>
          <label className="text-[10px] text-muted uppercase tracking-wider">
            Description
          </label>
          <input
            value={ad.copyVariation.description}
            onChange={(e) => handleCopyChange("description", e.target.value)}
            className="w-full px-2 py-1 text-xs border border-border rounded bg-background focus:border-accent focus:outline-none"
          />
        </div>

        {/* Destination URL */}
        <div className="text-[10px] text-muted truncate">
          {ad.destinationUrl}
        </div>
      </div>
    </div>
  );
}
