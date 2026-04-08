"use client";

import { useEffect, useRef, useState } from "react";
import Image from "next/image";
import {
  TEMPLATE_SCHEMAS,
  type FieldDefinition,
  type TemplateSchema,
} from "../../_shared/wineAdContext";

const LS_KEY = "pdp_custom_templates";

const TYPE_COLORS: Record<string, string> = {
  pdp: "bg-violet-100 text-violet-700",
  score: "bg-amber-100 text-amber-700",
  lifestyle: "bg-pink-100 text-pink-700",
  testimonial: "bg-blue-100 text-blue-700",
  offer: "bg-red-100 text-red-700",
};

// ── Predefined field catalogue ───────────────────────────────────────────────

interface FieldOption {
  key: string;
  label: string;
  def: FieldDefinition;
  defaultOn?: boolean;
}

const FIELD_GROUPS: { group: string; fields: FieldOption[] }[] = [
  {
    group: "Feed — always required",
    fields: [
      { key: "wine_display_name", label: "Wine Name", defaultOn: true, def: { source: "feed", required: true, label: "Wine Name" } },
      { key: "sale_price", label: "Sale Price", defaultOn: true, def: { source: "feed", required: true, label: "Sale Price" } },
      { key: "retail_price", label: "Retail Price", defaultOn: true, def: { source: "feed", required: true, label: "Retail Price" } },
    ],
  },
  {
    group: "Feed — pricing extras",
    fields: [
      { key: "savings", label: "Savings Amount", def: { source: "feed", required: false, label: "Savings Amount" } },
      { key: "discount_pct", label: "Discount %", def: { source: "feed", required: false, label: "Discount %" } },
    ],
  },
  {
    group: "Feed — score (hidden if absent)",
    fields: [
      { key: "score_badge", label: "Score Badge", def: { source: "feed", required: false, fallback: "hide_element", label: "Score Badge" } },
      { key: "score_label", label: "Score Source (e.g. Wine Spectator)", def: { source: "feed", required: false, fallback: "hide_element", label: "Score Source" } },
      { key: "score_quote", label: "Score Quote", def: { source: "feed", required: false, fallback: "hide_element", label: "Score Quote" } },
    ],
  },
  {
    group: "Feed — wine details",
    fields: [
      { key: "producer", label: "Producer", def: { source: "feed", required: false, label: "Producer" } },
      { key: "varietal", label: "Varietal", def: { source: "feed", required: false, label: "Varietal" } },
      { key: "appellation", label: "Appellation / Region", def: { source: "feed", required: false, label: "Appellation" } },
      { key: "vintage", label: "Vintage Year", def: { source: "feed", required: false, label: "Vintage" } },
      { key: "vineyard", label: "Vineyard", def: { source: "feed", required: false, fallback: "hide_element", label: "Vineyard" } },
      { key: "abv", label: "ABV %", def: { source: "feed", required: false, label: "ABV" } },
    ],
  },
  {
    group: "AI Copy (Claude)",
    fields: [
      { key: "headline", label: "Headline", defaultOn: true, def: { source: "ai_copy", required: true, label: "Headline" } },
      { key: "primary_text", label: "Primary Text", defaultOn: true, def: { source: "ai_copy", required: true, label: "Primary Text" } },
      { key: "description", label: "Description", def: { source: "ai_copy", required: false, label: "Description" } },
    ],
  },
  {
    group: "AI Image (Gemini)",
    fields: [
      { key: "background_image", label: "Background Image", defaultOn: true, def: { source: "ai_image", required: true, label: "Background Image" } },
    ],
  },
  {
    group: "Static / hardcoded",
    fields: [
      { key: "cta_button", label: "CTA Button", def: { source: "static", required: true, default: "Shop Now →", label: "CTA Button" } },
      { key: "logo", label: "Logo", def: { source: "static", required: true, default: "Wine Spies", label: "Logo" } },
    ],
  },
];

// ── Add Template Modal ────────────────────────────────────────────────────────

function AddTemplateModal({
  onSave,
  onClose,
}: {
  onSave: (schema: TemplateSchema) => void;
  onClose: () => void;
}) {
  const [name, setName] = useState("");
  const [type, setType] = useState("pdp");
  const [enabledFields, setEnabledFields] = useState<Set<string>>(() => {
    const defaults = new Set<string>();
    for (const group of FIELD_GROUPS) {
      for (const f of group.fields) {
        if (f.defaultOn) defaults.add(f.key);
      }
    }
    return defaults;
  });
  const overlayRef = useRef<HTMLDivElement>(null);

  const slugify = (s: string) =>
    s.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");

  const toggleField = (key: string) => {
    setEnabledFields((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  };

  const handleSave = () => {
    if (!name.trim()) return;
    const fields: Record<string, FieldDefinition> = {};
    for (const group of FIELD_GROUPS) {
      for (const f of group.fields) {
        if (enabledFields.has(f.key)) {
          fields[f.key] = f.def;
        }
      }
    }
    onSave({
      id: slugify(name.trim()),
      name: name.trim(),
      type,
      fields,
    });
  };

  // Close on backdrop click
  const handleOverlayClick = (e: React.MouseEvent) => {
    if (e.target === overlayRef.current) onClose();
  };

  return (
    <div
      ref={overlayRef}
      onClick={handleOverlayClick}
      className="fixed inset-0 z-50 bg-black/40 flex items-center justify-center p-4"
    >
      <div className="bg-surface border border-border rounded-2xl w-full max-w-lg max-h-[85vh] flex flex-col shadow-xl">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-border">
          <h2 className="font-semibold text-foreground">Add Template</h2>
          <button
            onClick={onClose}
            className="text-muted hover:text-foreground transition-colors"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4 flex flex-col gap-5">
          {/* Name */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-muted uppercase tracking-wide">
              Template Name
            </label>
            <input
              autoFocus
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. White Black Diagonal"
              className="px-3 py-2 text-sm border border-border rounded-lg bg-surface focus:outline-none focus:ring-1 focus:ring-accent"
            />
            {name && (
              <div className="text-[11px] text-muted">
                ID: <code className="font-mono">{slugify(name.trim()) || "…"}</code>
              </div>
            )}
          </div>

          {/* Type */}
          <div className="flex flex-col gap-1.5">
            <label className="text-[11px] font-semibold text-muted uppercase tracking-wide">
              Type
            </label>
            <select
              value={type}
              onChange={(e) => setType(e.target.value)}
              className="px-3 py-2 text-sm border border-border rounded-lg bg-surface focus:outline-none focus:ring-1 focus:ring-accent"
            >
              <option value="pdp">PDP / Product Hero</option>
              <option value="score">Score Focus</option>
              <option value="offer">Offer / Promo</option>
              <option value="testimonial">Testimonial</option>
              <option value="lifestyle">Lifestyle / Brand</option>
            </select>
          </div>

          {/* Fields */}
          <div className="flex flex-col gap-3">
            <label className="text-[11px] font-semibold text-muted uppercase tracking-wide">
              Fields
            </label>
            {FIELD_GROUPS.map((group) => (
              <div key={group.group}>
                <div className="text-[10px] font-semibold text-muted/60 uppercase tracking-wide mb-1.5">
                  {group.group}
                </div>
                <div className="flex flex-col gap-1">
                  {group.fields.map((f) => (
                    <label
                      key={f.key}
                      className="flex items-center gap-2.5 cursor-pointer group"
                    >
                      <input
                        type="checkbox"
                        checked={enabledFields.has(f.key)}
                        onChange={() => toggleField(f.key)}
                        className="rounded accent-accent"
                      />
                      <span className="text-sm text-foreground group-hover:text-accent transition-colors">
                        {f.label}
                      </span>
                      <code className="text-[10px] text-muted font-mono ml-auto">
                        {f.key}
                      </code>
                    </label>
                  ))}
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-border">
          <div className="text-[11px] text-muted">
            {enabledFields.size} field{enabledFields.size !== 1 ? "s" : ""} selected
          </div>
          <div className="flex gap-2">
            <button
              onClick={onClose}
              className="px-3 py-2 text-sm text-muted hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={!name.trim() || enabledFields.size === 0}
              className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg disabled:opacity-40 disabled:cursor-not-allowed hover:bg-accent/90 transition-colors"
            >
              Add Template
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ── Template card ─────────────────────────────────────────────────────────────

function TemplatePlaceholder({ name, type }: { name: string; type: string }) {
  const color = TYPE_COLORS[type] ?? "bg-background text-muted";
  const initial = name.charAt(0).toUpperCase();
  return (
    <div className={`w-full h-full flex flex-col items-center justify-center gap-2 ${color} bg-opacity-20`}>
      <div className={`w-12 h-12 rounded-xl flex items-center justify-center text-xl font-bold ${color}`}>
        {initial}
      </div>
      <div className="text-[11px] font-medium text-center px-3 leading-snug opacity-70">
        {name}
      </div>
    </div>
  );
}

function TemplateCard({
  template,
  selected,
  onToggle,
  onDelete,
}: {
  template: TemplateSchema;
  selected: boolean;
  onToggle: () => void;
  onDelete?: () => void;
}) {
  const [imgError, setImgError] = useState(false);
  const typeColor =
    TYPE_COLORS[template.type] ?? "bg-background text-muted border border-border";
  const showImage = !!template.thumbnail && !imgError;

  return (
    <div className="relative group">
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
            <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
            </svg>
          )}
        </div>

        {/* Thumbnail / placeholder */}
        <div className="w-full aspect-square rounded-t-xl overflow-hidden bg-background relative">
          {showImage ? (
            <Image
              src={template.thumbnail!}
              alt={template.name}
              fill
              className="object-cover"
              sizes="(max-width: 640px) 50vw, 33vw"
              onError={() => setImgError(true)}
            />
          ) : (
            <TemplatePlaceholder name={template.name} type={template.type} />
          )}
        </div>

        <div className="p-3">
          <div className="flex items-center gap-2 mb-1">
            <span className={`text-[10px] font-semibold uppercase tracking-wide px-1.5 py-0.5 rounded ${typeColor}`}>
              {template.type}
            </span>
          </div>
          <div className="text-sm font-semibold text-foreground">{template.name}</div>
          <div className="text-[11px] text-muted mt-0.5">
            {Object.keys(template.fields).length} fields
          </div>
        </div>
      </button>

      {/* Delete button for custom templates */}
      {onDelete && (
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(); }}
          className="absolute top-2 left-2 z-10 w-5 h-5 rounded-full bg-danger/80 text-white flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          title="Remove template"
        >
          <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      )}
    </div>
  );
}

// ── TemplateSelector root ─────────────────────────────────────────────────────

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
  const [showModal, setShowModal] = useState(false);
  const [customTemplates, setCustomTemplates] = useState<TemplateSchema[]>(() => {
    if (typeof window === "undefined") return [];
    try {
      const raw = localStorage.getItem(LS_KEY);
      return raw ? (JSON.parse(raw) as TemplateSchema[]) : [];
    } catch {
      return [];
    }
  });

  // Sync to localStorage whenever customTemplates changes
  useEffect(() => {
    try {
      localStorage.setItem(LS_KEY, JSON.stringify(customTemplates));
    } catch {}
  }, [customTemplates]);

  const builtInTemplates = Object.values(TEMPLATE_SCHEMAS);
  const allTemplates = [...builtInTemplates, ...customTemplates];
  const totalAds = selectedWineCount * selectedTemplateIds.length;

  const handleSave = (schema: TemplateSchema) => {
    setCustomTemplates((prev) => {
      // Replace if ID already exists, otherwise append
      const exists = prev.findIndex((t) => t.id === schema.id);
      if (exists >= 0) {
        const next = [...prev];
        next[exists] = schema;
        return next;
      }
      return [...prev, schema];
    });
    setShowModal(false);
    // Auto-select the newly added template
    onToggle(schema.id);
  };

  const handleDelete = (id: string) => {
    setCustomTemplates((prev) => prev.filter((t) => t.id !== id));
  };

  const customIds = new Set(customTemplates.map((t) => t.id));

  return (
    <>
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
          <div className="rounded-lg border border-border bg-surface px-4 py-3 text-sm">
            <span className="font-medium text-foreground">
              {selectedWineCount} wine{selectedWineCount !== 1 ? "s" : ""} ×{" "}
              {selectedTemplateIds.length} template{selectedTemplateIds.length !== 1 ? "s" : ""} ={" "}
              <span className="text-accent font-bold">{totalAds} ads</span>
            </span>
          </div>
        )}

        {/* Template grid */}
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {allTemplates.map((template) => (
            <TemplateCard
              key={template.id}
              template={template}
              selected={selectedTemplateIds.includes(template.id)}
              onToggle={() => onToggle(template.id)}
              onDelete={customIds.has(template.id) ? () => handleDelete(template.id) : undefined}
            />
          ))}

          {/* Add new template */}
          <button
            type="button"
            onClick={() => setShowModal(true)}
            className="rounded-xl border border-dashed border-border bg-surface flex items-center justify-center aspect-square text-muted text-sm hover:border-accent hover:text-accent transition-colors"
          >
            <div className="text-center p-4">
              <svg className="w-6 h-6 mx-auto mb-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 4v16m8-8H4" />
              </svg>
              <div className="text-[11px] font-medium">Add Template</div>
            </div>
          </button>
        </div>
      </div>

      {showModal && (
        <AddTemplateModal onSave={handleSave} onClose={() => setShowModal(false)} />
      )}
    </>
  );
}
