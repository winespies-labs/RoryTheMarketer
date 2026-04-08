"use client";

import Image from "next/image";
import {
  TEMPLATE_SCHEMAS,
  type TemplateSchema,
} from "../../_shared/wineAdContext";

const TYPE_COLORS: Record<string, string> = {
  pdp: "bg-violet-100 text-violet-700",
  score: "bg-amber-100 text-amber-700",
  lifestyle: "bg-pink-100 text-pink-700",
  testimonial: "bg-blue-100 text-blue-700",
  offer: "bg-red-100 text-red-700",
};

function TemplateCard({
  template,
  selected,
  onToggle,
}: {
  template: TemplateSchema;
  selected: boolean;
  onToggle: () => void;
}) {
  const typeColor =
    TYPE_COLORS[template.type] ?? "bg-background text-muted border border-border";

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
      {/* Selection indicator */}
      <div
        className={`absolute top-2 right-2 z-10 w-5 h-5 rounded-full border-2 flex items-center justify-center transition-all ${
          selected ? "border-accent bg-accent" : "border-border bg-surface"
        }`}
      >
        {selected && (
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
      </div>

      {/* Thumbnail */}
      <div className="w-full aspect-square rounded-t-xl overflow-hidden bg-background relative">
        {template.thumbnail ? (
          <Image
            src={template.thumbnail}
            alt={template.name}
            fill
            className="object-cover"
            sizes="(max-width: 640px) 50vw, 33vw"
            onError={() => {}} // silently fail — placeholder shows
          />
        ) : (
          <div className="w-full h-full flex items-center justify-center">
            <div className="text-muted/30 text-xs font-mono text-center p-4">
              {template.name}
            </div>
          </div>
        )}
      </div>

      <div className="p-3">
        <div className="flex items-center gap-2 mb-1">
          <span
            className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${typeColor}`}
          >
            {template.type}
          </span>
        </div>
        <div className="text-sm font-semibold text-foreground">{template.name}</div>
        <div className="text-[11px] text-muted mt-0.5">
          {Object.keys(template.fields).length} fields
        </div>
      </div>
    </button>
  );
}

interface TemplateSelectorProps {
  selectedWineCount: number;
  selectedTemplateIds: string[];
  onToggle: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
}

export default function TemplateSelector({
  selectedWineCount,
  selectedTemplateIds,
  onToggle,
  onBack,
  onNext,
}: TemplateSelectorProps) {
  const templates = Object.values(TEMPLATE_SCHEMAS);
  const totalAds = selectedWineCount * selectedTemplateIds.length;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Select Templates</h2>
          <p className="text-sm text-muted mt-0.5">
            Each selected template generates one ad per wine.
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
            onClick={onNext}
            disabled={selectedTemplateIds.length === 0}
            className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent/90 transition-colors"
          >
            Next →
          </button>
        </div>
      </div>

      {/* Multiplication summary */}
      {selectedTemplateIds.length > 0 && (
        <div className="rounded-lg border border-border bg-surface px-4 py-3 text-sm flex items-center gap-2">
          <span className="font-medium text-foreground">
            {selectedWineCount} wine{selectedWineCount !== 1 ? "s" : ""} × {selectedTemplateIds.length} template{selectedTemplateIds.length !== 1 ? "s" : ""} ={" "}
            <span className="text-accent font-bold">{totalAds} ads</span>
          </span>
        </div>
      )}

      {/* Template grid */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {templates.map((template) => (
          <TemplateCard
            key={template.id}
            template={template}
            selected={selectedTemplateIds.includes(template.id)}
            onToggle={() => onToggle(template.id)}
          />
        ))}

        {/* Add new template placeholder */}
        <div className="rounded-xl border border-dashed border-border bg-surface flex items-center justify-center aspect-square text-muted text-sm hover:border-accent/40 transition-colors cursor-not-allowed">
          <div className="text-center p-4">
            <svg
              className="w-6 h-6 mx-auto mb-2 text-muted"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
            >
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
            </svg>
            <div className="text-[11px]">Add Template</div>
            <div className="text-[10px] text-muted/60">(coming soon)</div>
          </div>
        </div>
      </div>
    </div>
  );
}
