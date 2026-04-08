"use client";

import { useState } from "react";
import type { BatchMappingResult, TemplateMappingResult } from "../../_shared/wineAdContext";
import FieldMappingRow from "./FieldMappingRow";

// ── Template sub-accordion ──────────────────────────────────────────────────

function TemplateMappingAccordion({
  mapping,
  wineOverrides,
  onOverride,
}: {
  mapping: TemplateMappingResult;
  /** Wine-level overrides — same for every template of this wine */
  wineOverrides: Record<string, string>;
  onOverride: (fieldKey: string, value: string) => void;
}) {
  const [open, setOpen] = useState(false);

  return (
    <div className="border border-border/50 rounded-lg overflow-hidden">
      {/* Header row */}
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-4 py-2.5 text-left hover:bg-background/50 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium text-foreground">
            {mapping.template.name}
          </span>
          <span
            className={`text-[10px] font-semibold px-1.5 py-0.5 rounded uppercase tracking-wide ${
              mapping.blocked
                ? "bg-danger/10 text-danger"
                : "bg-success/10 text-success"
            }`}
          >
            {mapping.blocked ? `✗ Blocked` : "✅ Ready"}
          </span>
          {mapping.blocked && (
            <span className="text-[11px] text-danger">
              {mapping.blocked_reasons[0]}
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {/* Field table */}
      {open && (
        <div className="border-t border-border/40 px-4 py-2 bg-background/30">
          <table className="w-full">
            <thead>
              <tr className="border-b border-border/40">
                <th className="pb-1.5 text-left text-[10px] font-semibold text-muted uppercase tracking-wide pr-3">
                  Field
                </th>
                <th className="pb-1.5 text-left text-[10px] font-semibold text-muted uppercase tracking-wide pr-3">
                  Source
                </th>
                <th className="pb-1.5 text-left text-[10px] font-semibold text-muted uppercase tracking-wide pr-3">
                  Status
                </th>
                <th className="pb-1.5 text-left text-[10px] font-semibold text-muted uppercase tracking-wide">
                  Value / Action
                </th>
              </tr>
            </thead>
            <tbody>
              {mapping.fields.map((field) => (
                <FieldMappingRow
                  key={field.field}
                  field={field}
                  mappingKey={mapping.mapping_key}
                  onOverride={onOverride}
                  overrideValue={wineOverrides[field.field]}
                />
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

// ── Wine section accordion ──────────────────────────────────────────────────

function WineSection({
  saleId,
  displayName,
  mappings,
  wineOverrides,
  onOverride,
}: {
  saleId: number;
  displayName: string;
  mappings: TemplateMappingResult[];
  /** Wine-level overrides keyed by fieldKey */
  wineOverrides: Record<string, string>;
  onOverride: (saleId: number, fieldKey: string, value: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const allReady = mappings.every((m) => m.ready);
  const blockedCount = mappings.filter((m) => m.blocked).length;

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-5 py-3.5 text-left bg-surface hover:bg-background/50 transition-colors"
      >
        <div className="flex items-center gap-3">
          <svg
            className={`w-4 h-4 text-muted transition-transform ${open ? "rotate-90" : ""}`}
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
          </svg>
          <span className="text-sm font-semibold text-foreground line-clamp-1">
            {displayName}
          </span>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {allReady ? (
            <span className="text-[11px] font-medium text-success">
              {mappings.length} ad{mappings.length !== 1 ? "s" : ""} ready
            </span>
          ) : (
            <>
              {blockedCount > 0 && (
                <span className="text-[11px] font-medium text-danger">
                  {blockedCount} blocked
                </span>
              )}
              {mappings.length - blockedCount > 0 && (
                <span className="text-[11px] font-medium text-success">
                  {mappings.length - blockedCount} ready
                </span>
              )}
            </>
          )}
        </div>
      </button>

      {open && (
        <div className="px-5 pb-4 pt-2 bg-background/20 flex flex-col gap-2">
          {mappings.map((mapping) => (
            <TemplateMappingAccordion
              key={mapping.mapping_key}
              mapping={mapping}
              wineOverrides={wineOverrides}
              onOverride={(fieldKey, value) =>
                onOverride(saleId, fieldKey, value)
              }
            />
          ))}
        </div>
      )}
    </div>
  );
}

// ── ReviewBrief root ────────────────────────────────────────────────────────

interface ReviewBriefProps {
  batch: BatchMappingResult;
  overrides: Record<number, Record<string, string>>;
  onOverride: (saleId: number, fieldKey: string, value: string) => void;
  onBack: () => void;
  onGenerate: () => void;
}

export default function ReviewBrief({
  batch,
  overrides,
  onOverride,
  onBack,
  onGenerate,
}: ReviewBriefProps) {
  // Group mappings by wine
  const byWine = batch.mappings.reduce<
    Map<number, TemplateMappingResult[]>
  >((acc, m) => {
    const existing = acc.get(m.sale_id) ?? [];
    acc.set(m.sale_id, [...existing, m]);
    return acc;
  }, new Map());

  const canGenerate = batch.ready_count > 0;
  const hasBlocked = batch.blocked_count > 0;

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Review Brief</h2>
          <p className="text-sm text-muted mt-0.5">
            Confirm what will be populated before generating. Override any feed
            value inline.
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
            disabled={!canGenerate}
            className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent/90 transition-colors"
          >
            Generate {batch.ready_count} Ad{batch.ready_count !== 1 ? "s" : ""} →
          </button>
        </div>
      </div>

      {/* Summary bar */}
      <div
        className={`rounded-lg border px-4 py-3 flex items-center gap-4 text-sm ${
          hasBlocked
            ? "border-amber-200 bg-amber-50"
            : "border-success/20 bg-success/5"
        }`}
      >
        <span className="font-medium text-foreground">
          {batch.ready_count} of {batch.total} ad{batch.total !== 1 ? "s" : ""}{" "}
          ready
        </span>
        {hasBlocked && (
          <span className="text-amber-700 text-[12px]">
            {batch.blocked_count} blocked — see details below
          </span>
        )}
        {!hasBlocked && (
          <span className="text-success text-[12px]">All ads ready ✓</span>
        )}
      </div>

      {/* Blocked summary */}
      {hasBlocked && (
        <div className="rounded-lg border border-danger/20 bg-danger/5 px-4 py-3">
          <div className="text-[12px] font-semibold text-danger mb-2">
            Blocked combinations
          </div>
          <ul className="space-y-1">
            {batch.mappings
              .filter((m) => m.blocked)
              .map((m) => (
                <li key={m.mapping_key} className="text-[12px] text-danger/80">
                  {m.context.display_name} × {m.template.name}:{" "}
                  {m.blocked_reasons.join(", ")}
                </li>
              ))}
          </ul>
        </div>
      )}

      {/* Wine accordions */}
      <div className="flex flex-col gap-3">
        {Array.from(byWine.entries()).map(([saleId, mappings]) => (
          <WineSection
            key={saleId}
            saleId={saleId}
            displayName={mappings[0].context.display_name}
            mappings={mappings}
            wineOverrides={overrides[saleId] ?? {}}
            onOverride={onOverride}
          />
        ))}
      </div>
    </div>
  );
}
