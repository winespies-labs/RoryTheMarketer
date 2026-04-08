"use client";

import Image from "next/image";
import { useState } from "react";
import type {
  GeneratedAd,
  AdGenerationStatus,
} from "../hooks/useGenerator";

// ── Status badge ────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: AdGenerationStatus }) {
  if (status === "pending")
    return <span className="text-[11px] text-muted">Pending…</span>;
  if (status === "generating_copy")
    return (
      <span className="text-[11px] text-accent animate-pulse flex items-center gap-1">
        <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Writing copy…
      </span>
    );
  if (status === "generating_image")
    return (
      <span className="text-[11px] text-accent animate-pulse flex items-center gap-1">
        <svg className="w-3 h-3 animate-spin" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
        </svg>
        Generating image…
      </span>
    );
  if (status === "complete")
    return <span className="text-[11px] text-success">✓ Complete</span>;
  if (status === "error")
    return <span className="text-[11px] text-danger">Error</span>;
  return null;
}

// ── Editable text field ─────────────────────────────────────────────────────

function EditableField({
  label,
  value,
  onChange,
  multiline = false,
  maxChars,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  maxChars?: number;
}) {
  return (
    <div className="flex flex-col gap-1">
      <div className="flex items-center justify-between">
        <label className="text-[10px] font-semibold text-muted uppercase tracking-wide">
          {label}
        </label>
        {maxChars && value && (
          <span
            className={`text-[10px] ${value.length > maxChars ? "text-danger" : "text-muted"}`}
          >
            {value.length}/{maxChars}
          </span>
        )}
      </div>
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          rows={3}
          className="w-full px-2.5 py-2 text-sm border border-border rounded-lg bg-surface focus:outline-none focus:ring-1 focus:ring-accent resize-none"
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full px-2.5 py-2 text-sm border border-border rounded-lg bg-surface focus:outline-none focus:ring-1 focus:ring-accent"
        />
      )}
    </div>
  );
}

// ── Ad card ─────────────────────────────────────────────────────────────────

function AdCard({
  ad,
  onUpdateField,
  onRegenerateCopy,
  onRegenerateImage,
  onToggleSelected,
}: {
  ad: GeneratedAd;
  onUpdateField: (field: "headline" | "primary_text" | "description", value: string) => void;
  onRegenerateCopy: () => void;
  onRegenerateImage: () => void;
  onToggleSelected: () => void;
}) {
  const [imageError, setImageError] = useState(false);
  const isGenerating =
    ad.status === "generating_copy" || ad.status === "generating_image";
  const isPending = ad.status === "pending";

  return (
    <div
      className={`rounded-xl border bg-surface transition-all ${
        ad.selected ? "border-border" : "border-border/40 opacity-60"
      }`}
    >
      {/* Card header */}
      <div className="flex items-center gap-3 px-4 py-3 border-b border-border">
        <input
          type="checkbox"
          checked={ad.selected}
          onChange={onToggleSelected}
          className="rounded"
        />
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground truncate">
            {ad.context.display_name}
          </div>
          <div className="text-[11px] text-muted">{ad.template.name}</div>
        </div>
        <StatusBadge status={ad.status} />
      </div>

      {/* Content */}
      <div className="flex gap-4 p-4">
        {/* Image */}
        <div className="w-48 h-48 shrink-0 rounded-lg overflow-hidden bg-background relative border border-border">
          {ad.image_url && !imageError ? (
            <Image
              src={ad.image_url}
              alt={ad.context.display_name}
              fill
              className="object-cover"
              sizes="192px"
              onError={() => setImageError(true)}
            />
          ) : (isPending || isGenerating) ? (
            <div className="w-full h-full flex items-center justify-center">
              <div className="text-center text-muted">
                <svg
                  className={`w-8 h-8 mx-auto mb-2 ${ad.status === "generating_image" ? "animate-spin text-accent" : "text-muted"}`}
                  viewBox="0 0 24 24"
                  fill="none"
                >
                  {ad.status === "generating_image" ? (
                    <>
                      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                    </>
                  ) : (
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} stroke="currentColor" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  )}
                </svg>
                <div className="text-[11px]">
                  {ad.status === "generating_image" ? "Generating…" : "Awaiting"}
                </div>
              </div>
            </div>
          ) : (
            <div className="w-full h-full flex items-center justify-center text-muted text-[11px]">
              No image
            </div>
          )}

          {/* Regenerate image button */}
          {ad.status === "complete" && (
            <button
              onClick={onRegenerateImage}
              className="absolute bottom-1.5 right-1.5 bg-black/60 hover:bg-black/80 text-white text-[10px] px-2 py-1 rounded-md transition-colors"
            >
              Regenerate
            </button>
          )}
        </div>

        {/* Copy fields */}
        <div className="flex-1 min-w-0 flex flex-col gap-3">
          {ad.status === "complete" || ad.headline ? (
            <>
              <EditableField
                label="Headline"
                value={ad.headline}
                onChange={(v) => onUpdateField("headline", v)}
                maxChars={40}
              />
              <EditableField
                label="Primary Text"
                value={ad.primary_text}
                onChange={(v) => onUpdateField("primary_text", v)}
                multiline
              />
              <EditableField
                label="Description"
                value={ad.description}
                onChange={(v) => onUpdateField("description", v)}
                maxChars={30}
              />
              <div className="text-[11px] text-muted truncate">
                <span className="font-medium">URL:</span>{" "}
                <a
                  href={ad.sale_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="hover:text-accent transition-colors"
                >
                  {ad.sale_url}
                </a>
              </div>

              {/* Regenerate copy */}
              <button
                onClick={onRegenerateCopy}
                disabled={isGenerating}
                className="self-start text-[11px] text-muted hover:text-foreground transition-colors disabled:opacity-40"
              >
                ↺ Regenerate copy
              </button>
            </>
          ) : isPending || isGenerating ? (
            <div className="flex items-center gap-2 text-sm text-muted py-4">
              <svg className="w-4 h-4 animate-spin text-accent" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {ad.status === "generating_copy" ? "Writing copy…" : "Queued"}
            </div>
          ) : ad.status === "error" ? (
            <div className="text-sm text-danger py-4">
              {ad.error ?? "Generation failed"}
              <button
                onClick={onRegenerateCopy}
                className="block mt-2 text-[11px] text-accent hover:underline"
              >
                Retry
              </button>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

// ── GenerationQueue root ─────────────────────────────────────────────────────

interface GenerationQueueProps {
  ads: GeneratedAd[];
  isGenerating: boolean;
  progress: { completed: number; total: number };
  onStartGeneration: () => void;
  onRegenerateCopy: (key: string) => void;
  onRegenerateImage: (key: string) => void;
  onUpdateField: (key: string, field: "headline" | "primary_text" | "description", value: string) => void;
  onToggleSelected: (key: string) => void;
  onBack: () => void;
  onNext: () => void;
}

export default function GenerationQueue({
  ads,
  isGenerating,
  progress,
  onStartGeneration,
  onRegenerateCopy,
  onRegenerateImage,
  onUpdateField,
  onToggleSelected,
  onBack,
  onNext,
}: GenerationQueueProps) {
  const selectedCount = ads.filter((a) => a.selected).length;
  const allComplete = ads.length > 0 && ads.every((a) => a.status === "complete" || a.status === "error");

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Generate & Review</h2>
          <p className="text-sm text-muted mt-0.5">
            Review and edit each ad before publishing.
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          <button
            onClick={onBack}
            disabled={isGenerating}
            className="px-3 py-2 text-sm text-muted hover:text-foreground transition-colors disabled:opacity-40"
          >
            ← Back
          </button>
          {ads.length === 0 ? (
            <button
              onClick={onStartGeneration}
              className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors"
            >
              Start Generation
            </button>
          ) : (
            <button
              onClick={onNext}
              disabled={selectedCount === 0 || !allComplete}
              className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent/90 transition-colors"
            >
              Publish {selectedCount > 0 ? `${selectedCount} Ads` : ""} →
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {ads.length > 0 && (
        <div className="space-y-1">
          <div className="flex items-center justify-between text-[12px] text-muted">
            <span>{isGenerating ? "Generating…" : "Done"}</span>
            <span>
              {progress.completed} / {progress.total}
            </span>
          </div>
          <div className="h-1.5 bg-border rounded-full overflow-hidden">
            <div
              className="h-full bg-accent rounded-full transition-all duration-300"
              style={{
                width:
                  progress.total > 0
                    ? `${(progress.completed / progress.total) * 100}%`
                    : "0%",
              }}
            />
          </div>
        </div>
      )}

      {/* Empty state */}
      {ads.length === 0 && (
        <div className="rounded-xl border border-dashed border-border py-16 flex flex-col items-center gap-3 text-muted text-sm">
          <svg
            className="w-10 h-10 text-muted/40"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1}
              d="M19 11H5m14 0a2 2 0 012 2v6a2 2 0 01-2 2H5a2 2 0 01-2-2v-6a2 2 0 012-2m14 0V9a2 2 0 00-2-2M5 11V9a2 2 0 012-2m0 0V5a2 2 0 012-2h6a2 2 0 012 2v2M7 7h10"
            />
          </svg>
          <div className="text-center">
            <div className="font-medium text-foreground">Ready to generate</div>
            <div className="text-[12px] text-muted mt-0.5">
              Click Start Generation to begin
            </div>
          </div>
        </div>
      )}

      {/* Ad cards */}
      <div className="flex flex-col gap-4">
        {ads.map((ad) => (
          <AdCard
            key={ad.mapping_key}
            ad={ad}
            onUpdateField={(field, value) => onUpdateField(ad.mapping_key, field, value)}
            onRegenerateCopy={() => onRegenerateCopy(ad.mapping_key)}
            onRegenerateImage={() => onRegenerateImage(ad.mapping_key)}
            onToggleSelected={() => onToggleSelected(ad.mapping_key)}
          />
        ))}
      </div>
    </div>
  );
}
