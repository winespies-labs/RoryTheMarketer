"use client";

import { useState } from "react";
import type { FieldMappingResult } from "../../_shared/wineAdContext";

const STATUS_CONFIG = {
  ok: {
    icon: "✅",
    label: "Ready",
    color: "text-success",
  },
  missing_optional: {
    icon: "⚠️",
    label: "Hidden",
    color: "text-amber-600",
  },
  missing_required: {
    icon: "🚫",
    label: "Missing",
    color: "text-danger",
  },
  ai_generated: {
    icon: "🤖",
    label: "Will generate",
    color: "text-muted",
  },
  static: {
    icon: "🔒",
    label: "Static",
    color: "text-muted",
  },
};

const SOURCE_LABELS = {
  feed: "Feed",
  ai_copy: "AI (Claude)",
  ai_image: "AI (Gemini)",
  static: "Static",
};

interface FieldMappingRowProps {
  field: FieldMappingResult;
  mappingKey: string;
  onOverride: (fieldKey: string, value: string) => void;
  overrideValue?: string;
}

export default function FieldMappingRow({
  field,
  onOverride,
  overrideValue,
}: FieldMappingRowProps) {
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState("");

  const config = STATUS_CONFIG[field.status];
  const displayValue = overrideValue ?? field.value;

  const startEdit = () => {
    setDraft(displayValue ?? "");
    setEditing(true);
  };

  const commitEdit = () => {
    if (draft.trim() !== (displayValue ?? "").trim()) {
      onOverride(field.field, draft.trim());
    }
    setEditing(false);
  };

  const statusNote =
    overrideValue != null && overrideValue !== ""
      ? overrideValue
      : field.status === "missing_optional"
      ? `No ${field.label.toLowerCase()} — element will be hidden`
      : field.status === "missing_required"
      ? `Required — blocks generation`
      : field.status === "ai_generated"
      ? "—"
      : field.status === "static"
      ? displayValue ?? "—"
      : displayValue ?? "—";

  return (
    <tr className="border-b border-border/40 last:border-0 hover:bg-background/50 transition-colors">
      {/* Field name */}
      <td className="py-2 pr-3 text-[12px] font-medium text-foreground font-mono">
        {field.field}
      </td>

      {/* Source */}
      <td className="py-2 pr-3 text-[11px] text-muted whitespace-nowrap">
        {SOURCE_LABELS[field.source]}
      </td>

      {/* Status */}
      <td className="py-2 pr-3 whitespace-nowrap">
        <span className={`text-[11px] font-medium ${config.color}`}>
          {config.icon} {config.label}
        </span>
      </td>

      {/* Value / Action */}
      <td className="py-2 text-[12px] text-muted max-w-xs">
        {field.editable && field.source === "feed" ? (
          editing ? (
            <div className="flex items-center gap-1.5">
              <input
                autoFocus
                type="text"
                value={draft}
                onChange={(e) => setDraft(e.target.value)}
                onBlur={commitEdit}
                onKeyDown={(e) => {
                  if (e.key === "Enter") commitEdit();
                  if (e.key === "Escape") setEditing(false);
                }}
                className="flex-1 px-2 py-0.5 text-[12px] border border-accent rounded bg-surface focus:outline-none focus:ring-1 focus:ring-accent"
              />
              <button
                onClick={commitEdit}
                className="text-[10px] text-accent hover:underline shrink-0"
              >
                Save
              </button>
            </div>
          ) : (
            <button
              onClick={startEdit}
              className={`group text-left hover:text-foreground transition-colors max-w-full truncate ${
                overrideValue ? "text-accent font-medium" : ""
              }`}
              title={displayValue ?? undefined}
            >
              <span className="truncate block max-w-[240px]">
                {statusNote}
              </span>
              <span className="text-[10px] text-muted/60 opacity-0 group-hover:opacity-100 transition-opacity block -mt-0.5">
                click to override
              </span>
            </button>
          )
        ) : (
          <span
            className={`truncate block max-w-[240px] ${
              field.status === "missing_required" ? "text-danger" : ""
            }`}
            title={statusNote}
          >
            {statusNote}
          </span>
        )}
      </td>
    </tr>
  );
}
