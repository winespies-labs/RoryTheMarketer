// app/creative/ad-builder/studio/components/StylePicker.tsx
"use client";

import { useState, useRef } from "react";
import { useStudioStyles, type StudioStyle } from "../hooks/useStudioStyles";

const ANGLE_BADGE: Record<string, { label: string; cls: string }> = {
  usp:         { label: "USP",         cls: "bg-indigo-100 text-indigo-700 border-indigo-200" },
  testimonial: { label: "Testimonial", cls: "bg-amber-100 text-amber-700 border-amber-200" },
  lifestyle:   { label: "Lifestyle",   cls: "bg-pink-100 text-pink-700 border-pink-200" },
  offer:       { label: "Offer",       cls: "bg-red-100 text-red-700 border-red-200" },
  ugc:         { label: "UGC",         cls: "bg-green-100 text-green-700 border-green-200" },
  comparison:  { label: "Comparison",  cls: "bg-blue-100 text-blue-700 border-blue-200" },
};

function AngleBadge({ angle }: { angle: string | null }) {
  if (!angle) return null;
  const badge = ANGLE_BADGE[angle];
  if (!badge) return null;
  return (
    <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded border ${badge.cls}`}>
      {badge.label}
    </span>
  );
}

function StyleCard({
  style,
  selected,
  onSelect,
}: {
  style: StudioStyle;
  selected: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onSelect}
      className={`relative w-full text-left rounded-xl border transition-all ${
        selected
          ? "border-accent bg-accent/5 ring-1 ring-accent"
          : "border-border bg-surface hover:border-accent/40"
      }`}
    >
      {/* Selection indicator */}
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

      {/* Image */}
      <div className="w-full aspect-square rounded-t-xl overflow-hidden bg-background">
        {style.id ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`/api/ad-reference/image?id=${style.id}`}
            alt={style.label}
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

      {/* Label + badge */}
      <div className="p-3 flex items-start justify-between gap-2">
        <p className="text-sm font-semibold text-foreground truncate flex-1">{style.label}</p>
        <AngleBadge angle={style.angle} />
      </div>
    </button>
  );
}

function AddTemplateCard({ brand, onSaved }: { brand: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [analyzed, setAnalyzed] = useState<{
    label: string;
    angle: string;
    nanoBanana: string;
    adDescription: string;
    generationPrompt: string;
    promptOverrides: { numberOfVariations: number };
    notes: string;
  } | null>(null);
  const [label, setLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFileChange = (file: File) => {
    setImageFile(file);
    setAnalyzed(null);
    setError(null);
    const reader = new FileReader();
    reader.onload = (e) => setImagePreview(e.target?.result as string);
    reader.readAsDataURL(file);
  };

  const handleAnalyze = async () => {
    if (!imageFile) return;
    setAnalyzing(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("image", imageFile);
      fd.append("brand", brand);
      const res = await fetch("/api/ad-reference/generate-full", { method: "POST", body: fd });
      if (!res.ok) {
        const d = await res.json() as { error: string };
        throw new Error(d.error);
      }
      const data = await res.json() as typeof analyzed;
      setAnalyzed(data);
      setLabel(data?.label ?? "");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Analysis failed");
    }
    setAnalyzing(false);
  };

  const handleSave = async () => {
    if (!imageFile || !analyzed) return;
    setSaving(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("image", imageFile);
      fd.append("data", JSON.stringify({
        label: label || analyzed.label,
        brand,
        platform: "meta",
        format: "static_image",
        type: analyzed.angle,
        aspectRatio: "1:1",
        angle: analyzed.angle,
        nanoBanana: analyzed.nanoBanana,
        adDescription: analyzed.adDescription,
        generationPrompt: analyzed.generationPrompt,
        promptOverrides: analyzed.promptOverrides,
        notes: analyzed.notes,
      }));
      const res = await fetch("/api/ad-reference/create", { method: "POST", body: fd });
      if (!res.ok) {
        const d = await res.json() as { error: string };
        throw new Error(d.error);
      }
      setOpen(false);
      setImageFile(null);
      setImagePreview(null);
      setAnalyzed(null);
      setLabel("");
      onSaved();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Save failed");
    }
    setSaving(false);
  };

  if (!open) {
    return (
      <button
        type="button"
        onClick={() => setOpen(true)}
        className="w-full aspect-square rounded-xl border-2 border-dashed border-border hover:border-accent/50 bg-surface hover:bg-accent/5 flex flex-col items-center justify-center gap-2 transition-all text-muted hover:text-accent"
      >
        <svg className="w-8 h-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v16m8-8H4" />
        </svg>
        <span className="text-xs font-medium">Add Template</span>
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-accent/30 bg-surface p-4 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold">Add Template</p>
        <button type="button" onClick={() => { setOpen(false); setImageFile(null); setImagePreview(null); setAnalyzed(null); }} className="text-muted hover:text-foreground text-xs">Cancel</button>
      </div>

      {/* Image upload */}
      <button
        type="button"
        className="w-full aspect-square rounded-lg border-2 border-dashed border-border bg-background flex items-center justify-center cursor-pointer overflow-hidden"
        onClick={() => fileRef.current?.click()}
      >
        {imagePreview ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img src={imagePreview} alt="Preview" className="w-full h-full object-cover" />
        ) : (
          <span className="text-xs text-muted">Click to upload image</span>
        )}
      </button>
      <input
        ref={fileRef}
        type="file"
        accept="image/png,image/jpeg,image/webp"
        className="hidden"
        onChange={(e) => { const f = e.target.files?.[0]; if (f) handleFileChange(f); }}
      />

      {imageFile && !analyzed && (
        <button
          type="button"
          onClick={handleAnalyze}
          disabled={analyzing}
          className="w-full py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 transition-colors"
        >
          {analyzing ? "Analyzing..." : "Analyze with Claude"}
        </button>
      )}

      {analyzed && (
        <>
          <div>
            <label htmlFor="template-name" className="text-xs text-muted block mb-1">Name</label>
            <input
              id="template-name"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:border-accent"
            />
          </div>
          <div>
            <label className="text-xs text-muted block mb-1">Angle detected: <span className="font-medium text-foreground">{analyzed.angle}</span></label>
            <label className="text-xs text-muted block mb-1">Nano-banana: <span className="text-foreground">{analyzed.nanoBanana}</span></label>
          </div>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving}
            className="w-full py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-50 transition-colors"
          >
            {saving ? "Saving..." : "Save Template"}
          </button>
        </>
      )}

      {error && <p className="text-xs text-danger">{error}</p>}
    </div>
  );
}

export default function StylePicker({
  selected,
  onSelect,
  brand = "winespies",
}: {
  selected: StudioStyle | null;
  onSelect: (style: StudioStyle) => void;
  brand?: string;
}) {
  const { styles, loading, error, unregisteredCount, refresh } = useStudioStyles(brand);
  const [ingesting, setIngesting] = useState(false);
  const [ingestMsg, setIngestMsg] = useState<string | null>(null);

  const handleIngest = async () => {
    setIngesting(true);
    setIngestMsg(null);
    try {
      const res = await fetch(`/api/ad-reference/batch-ingest?brand=${brand}`, { method: "POST" });
      const data = await res.json() as { created: string[]; errors: string[] };
      const msg = `Ingested ${data.created.length} image(s)${data.errors.length ? ` • ${data.errors.length} error(s)` : ""}`;
      setIngestMsg(msg);
      refresh();
    } catch (e) {
      setIngestMsg(e instanceof Error ? e.message : "Ingest failed");
    }
    setIngesting(false);
  };

  return (
    <div className="flex flex-col gap-4">
      {/* Ingest banner */}
      {unregisteredCount > 0 && (
        <div className="flex items-center justify-between p-3 rounded-lg bg-amber-50 border border-amber-200">
          <p className="text-sm text-amber-800">
            {unregisteredCount} unregistered image{unregisteredCount > 1 ? "s" : ""} found in Static folder.
          </p>
          <button
            type="button"
            onClick={handleIngest}
            disabled={ingesting}
            className="text-sm font-medium text-amber-700 hover:text-amber-900 disabled:opacity-50"
          >
            {ingesting ? "Ingesting..." : "Ingest all"}
          </button>
        </div>
      )}
      {ingestMsg && <p className="text-xs text-muted">{ingestMsg}</p>}

      {/* Loading / error */}
      {loading && (
        <div className="flex items-center gap-2 text-sm text-muted py-8 justify-center">
          <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          Loading styles...
        </div>
      )}
      {error && <p className="text-sm text-danger">{error}</p>}

      {/* Empty state (no templates yet) */}
      {!loading && styles.length === 0 && unregisteredCount === 0 && (
        <div className="text-center py-8 text-muted text-sm">
          No templates yet. Add one below or drop images in{" "}
          <code className="text-xs bg-surface px-1 rounded">context/Examples/Ads/Static/</code>.
        </div>
      )}

      {/* Grid */}
      {!loading && (
        <div className="grid grid-cols-2 gap-3">
          {styles.map((style) => (
            <StyleCard
              key={style.id}
              style={style}
              selected={selected?.id === style.id}
              onSelect={() => onSelect(style)}
            />
          ))}
          <AddTemplateCard brand={brand} onSaved={refresh} />
        </div>
      )}
    </div>
  );
}
