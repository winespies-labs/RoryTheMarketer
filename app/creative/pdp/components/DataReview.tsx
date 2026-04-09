// app/creative/pdp/components/DataReview.tsx
"use client";

import { useState } from "react";
import Image from "next/image";
import type {
  BatchMappingResult,
  ResolvedField,
  FieldStatus,
} from "../../ad-builder/_shared/wineAdContext";
import type { WineOverrides } from "../hooks/useGenerator";

// Maps field keys to WineOverrides keys for inline editing
const FIELD_TO_OVERRIDE: Partial<Record<string, keyof WineOverrides>> = {
  wine_display_name: "wineName",
  score_badge: "score",
  cta_button: "ctaText",
};

function statusIcon(status: FieldStatus): string {
  switch (status) {
    case "ok": return "✅";
    case "missing_optional": return "⚠️";
    case "missing_required": return "🚫";
    case "ai_generated": return "🤖";
    case "static": return "🔒";
  }
}

function statusLabel(status: FieldStatus): string {
  switch (status) {
    case "ok": return "Ready";
    case "missing_optional": return "Hidden";
    case "missing_required": return "Blocked";
    case "ai_generated": return "Will generate";
    case "static": return "Static";
  }
}

function valueDisplay(field: ResolvedField): string {
  if (field.status === "ai_generated") return "—";
  if (field.status === "static") return String(field.value ?? "—");
  if (!field.will_render) return "—";
  if (field.value === null || field.value === "") return "—";
  return String(field.value);
}

function FieldRow({
  field,
  overrideValue,
  onOverride,
}: {
  field: ResolvedField;
  overrideValue?: string;
  onOverride?: (value: string) => void;
}) {
  const [editing, setEditing] = useState(false);
  const isEditable = field.source === "feed" && onOverride !== undefined;
  const displayValue = overrideValue !== undefined ? overrideValue : valueDisplay(field);

  return (
    <tr className="border-t border-border/30">
      <td className="py-1.5 pr-3 text-xs text-foreground font-mono">{field.key}</td>
      <td className="py-1.5 pr-3 text-xs text-muted capitalize">{field.source}</td>
      <td className="py-1.5 pr-3 text-xs">
        <span title={statusLabel(field.status)}>
          {statusIcon(field.status)}{" "}
          <span className="text-muted">{statusLabel(field.status)}</span>
        </span>
      </td>
      <td className="py-1.5 text-xs text-foreground min-w-[120px]">
        {isEditable && editing ? (
          <input
            autoFocus
            type="text"
            defaultValue={displayValue}
            onBlur={(e) => {
              onOverride!(e.target.value);
              setEditing(false);
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                onOverride!((e.target as HTMLInputElement).value);
                setEditing(false);
              }
              if (e.key === "Escape") setEditing(false);
            }}
            className="w-full px-1.5 py-0.5 border border-accent rounded text-xs bg-surface focus:outline-none"
          />
        ) : (
          <span
            className={isEditable ? "cursor-pointer hover:text-accent underline-offset-2 hover:underline" : ""}
            onClick={() => isEditable && setEditing(true)}
            title={isEditable ? "Click to edit" : field.description}
          >
            {displayValue || <span className="text-muted italic">empty</span>}
          </span>
        )}
      </td>
    </tr>
  );
}

function TemplateMappingRow({
  mappingKey,
  overrides,
  onOverride,
  batch,
}: {
  mappingKey: string;
  overrides: WineOverrides;
  onOverride: (field: keyof WineOverrides, value: string) => void;
  batch: BatchMappingResult;
}) {
  const [open, setOpen] = useState(false);
  const mapping = batch.mappings[mappingKey];
  if (!mapping) return null;

  return (
    <div className="border border-border/40 rounded-lg overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-3 py-2 bg-background hover:bg-surface transition-colors text-left"
      >
        <div className="flex items-center gap-2">
          <span className="text-xs font-medium text-foreground">{mapping.template_name}</span>
          {mapping.can_generate ? (
            <span className="text-[10px] text-success font-medium">✅ Ready</span>
          ) : (
            <span className="text-[10px] text-danger font-medium">
              🚫 Blocked — {mapping.blocking_fields.join(", ")}
            </span>
          )}
        </div>
        <svg
          className={`w-3.5 h-3.5 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor"
        >
          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      {open && (
        <div className="px-3 pb-3 pt-1 bg-surface overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr>
                <th className="text-left text-[10px] text-muted uppercase tracking-wide pb-1 pr-3">Field</th>
                <th className="text-left text-[10px] text-muted uppercase tracking-wide pb-1 pr-3">Source</th>
                <th className="text-left text-[10px] text-muted uppercase tracking-wide pb-1 pr-3">Status</th>
                <th className="text-left text-[10px] text-muted uppercase tracking-wide pb-1">Value</th>
              </tr>
            </thead>
            <tbody>
              {mapping.fields.map((field) => {
                const overrideKey = FIELD_TO_OVERRIDE[field.key];
                const overrideValue = overrideKey !== undefined ? overrides[overrideKey] : undefined;
                const handleOverride = overrideKey !== undefined
                  ? (v: string) => onOverride(overrideKey, v)
                  : undefined;
                return (
                  <FieldRow
                    key={field.key}
                    field={field}
                    overrideValue={overrideValue}
                    onOverride={handleOverride}
                  />
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function WineAccordionRow({
  saleId,
  batch,
  overrides,
  onOverride,
}: {
  saleId: number;
  batch: BatchMappingResult;
  overrides: WineOverrides;
  onOverride: (field: keyof WineOverrides, value: string) => void;
}) {
  const [open, setOpen] = useState(true);
  const context = batch.wines.find((w) => w.sale_id === saleId);
  if (!context) return null;

  const mappingKeys = batch.schemas.map((s) => `${saleId}:${s.template_id}`);
  const allReady = mappingKeys.every((k) => batch.mappings[k]?.can_generate);

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center gap-3 px-4 py-3 bg-surface hover:bg-background transition-colors text-left"
      >
        {context.composite_image_url && (
          <div className="w-10 h-14 shrink-0 relative rounded overflow-hidden bg-background">
            <Image
              src={context.composite_image_url}
              alt={context.display_name}
              fill
              className="object-contain"
              sizes="40px"
            />
          </div>
        )}
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-foreground truncate">{context.display_name}</div>
          <div className="text-xs text-muted mt-0.5">
            {context.sale_price} <span className="line-through">{context.retail_price}</span>
            {" · "}{context.discount_pct}% off
            {context.has_score && (
              <span className="ml-1 text-success">· {context.score_label}</span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {allReady ? (
            <span className="text-xs text-success font-medium">✅ Ready</span>
          ) : (
            <span className="text-xs text-danger font-medium">🚫 Issues</span>
          )}
          <svg
            className={`w-4 h-4 text-muted transition-transform ${open ? "rotate-180" : ""}`}
            fill="none" viewBox="0 0 24 24" stroke="currentColor"
          >
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
          </svg>
        </div>
      </button>

      {open && (
        <div className="px-4 pb-4 pt-2 flex flex-col gap-2">
          {mappingKeys.map((key) => (
            <TemplateMappingRow
              key={key}
              mappingKey={key}
              overrides={overrides}
              onOverride={onOverride}
              batch={batch}
            />
          ))}
        </div>
      )}
    </div>
  );
}

interface DataReviewProps {
  batch: BatchMappingResult;
  overrides: Record<number, WineOverrides>;
  onOverride: (saleId: number, field: keyof WineOverrides, value: string) => void;
  onBack: () => void;
  onGenerate: () => void;
}

export default function DataReview({
  batch,
  overrides,
  onOverride,
  onBack,
  onGenerate,
}: DataReviewProps) {
  const canGenerate = batch.blocked === 0;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Review Brief</h2>
          <p className="text-sm text-muted mt-0.5">
            Confirm what will be populated before generating. Click any feed value to edit it.
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
            className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
              canGenerate
                ? "bg-accent text-white hover:bg-accent/90"
                : "bg-border text-muted cursor-not-allowed"
            }`}
          >
            Generate {batch.total_ads} Ad{batch.total_ads !== 1 ? "s" : ""} →
          </button>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-surface px-4 py-3 flex items-center justify-between gap-4 text-sm">
        <div>
          <span className="font-medium text-foreground">{batch.wines.length} wine{batch.wines.length !== 1 ? "s" : ""}</span>
          {" × "}
          <span className="font-medium text-foreground">{batch.schemas.length} template{batch.schemas.length !== 1 ? "s" : ""}</span>
          {" = "}
          <span className="font-bold text-accent">{batch.total_ads} ads</span>
        </div>
        {batch.blocked > 0 ? (
          <span className="text-xs text-danger font-medium">
            🚫 {batch.blocked} blocked — fix required fields to enable generation
          </span>
        ) : (
          <span className="text-xs text-success font-medium">
            ✅ {batch.ready_to_generate} ads ready to generate
          </span>
        )}
      </div>

      <div className="flex flex-col gap-3">
        {batch.wines.map((ctx) => (
          <WineAccordionRow
            key={ctx.sale_id}
            saleId={ctx.sale_id}
            batch={batch}
            overrides={overrides[ctx.sale_id] ?? {}}
            onOverride={(field, value) => onOverride(ctx.sale_id, field, value)}
          />
        ))}
      </div>
    </div>
  );
}
