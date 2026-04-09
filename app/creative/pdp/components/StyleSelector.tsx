// app/creative/pdp/components/StyleSelector.tsx
"use client";

import { Fragment, useState, useCallback, useEffect } from "react";
import type { AdStyle } from "../hooks/useStyles";

// ─── StyleCard ────────────────────────────────────────────────────────────────

function StyleCard({
  style,
  selected,
  isEditing,
  onToggle,
  onEditPrompt,
}: {
  style: AdStyle;
  selected: boolean;
  isEditing: boolean;
  onToggle: () => void;
  onEditPrompt: () => void;
}) {
  return (
    <div
      className={`relative w-full text-left rounded-xl border transition-all ${
        selected
          ? "border-accent bg-accent/5 ring-1 ring-accent"
          : "border-border bg-surface"
      } ${isEditing ? "rounded-b-none border-b-0" : ""}`}
    >
      <button
        type="button"
        onClick={onToggle}
        className="w-full text-left"
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
      </button>

      <div className="p-3 flex items-center justify-between gap-2">
        <div className="text-sm font-semibold text-foreground truncate">{style.name}</div>
        <button
          type="button"
          onClick={onEditPrompt}
          className="shrink-0 text-xs text-accent hover:text-accent/80 transition-colors"
        >
          {isEditing ? "▲ Close" : "✏️ Edit prompt"}
        </button>
      </div>
    </div>
  );
}

// ─── PromptEditorPanel ────────────────────────────────────────────────────────

function PromptEditorPanel({
  styleId,
  styleName,
  onClose,
}: {
  styleId: string;
  styleName: string;
  onClose: () => void;
}) {
  const [prompt, setPrompt] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/ad-reference/detail?id=${styleId}`)
      .then((r) => r.json())
      .then((data) => {
        setPrompt((data as { referenceAd?: { generationPrompt?: string } }).referenceAd?.generationPrompt ?? "");
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [styleId]);

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/ad-reference/update", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ id: styleId, generationPrompt: prompt }),
      });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? "Save failed");
      }
      setSaved(true);
      setTimeout(() => {
        setSaved(false);
        onClose();
      }, 1200);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="col-span-full border border-accent border-t-0 rounded-b-xl bg-surface p-4 flex flex-col gap-3">
      <div className="text-xs font-semibold text-accent uppercase tracking-wide">
        Generation Prompt — {styleName}
      </div>
      {loading ? (
        <div className="text-sm text-muted py-4 text-center">Loading…</div>
      ) : (
        <>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={10}
            className="w-full px-3 py-2 text-xs font-mono border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-accent resize-y text-foreground"
          />
          {error && <div className="text-xs text-danger">{error}</div>}
          <div className="flex items-center justify-between gap-3">
            <div className="text-xs text-muted">Saves to Postgres — survives redeploys</div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={onClose}
                className="px-3 py-1.5 text-xs text-muted hover:text-foreground transition-colors"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || saved}
                className="px-4 py-1.5 text-xs font-semibold bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-60"
              >
                {saved ? "Saved ✓" : saving ? "Saving…" : "Save prompt"}
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}

// ─── AddTemplateCard ──────────────────────────────────────────────────────────

function AddTemplateCard({ onClick }: { onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="rounded-xl border border-dashed border-border bg-surface hover:border-accent/60 hover:bg-accent/5 transition-colors flex flex-col items-center justify-center gap-2 aspect-square text-muted"
    >
      <div className="w-8 h-8 rounded-full border-2 border-dashed border-muted/50 flex items-center justify-center text-xl font-light">+</div>
      <div className="text-xs font-medium">Add Template</div>
    </button>
  );
}

// ─── AddTemplateForm ──────────────────────────────────────────────────────────

function AddTemplateForm({
  onCancel,
  onCreated,
}: {
  onCancel: () => void;
  onCreated: () => void;
}) {
  const [image, setImage] = useState<File | null>(null);
  const [preview, setPreview] = useState<string>("");
  const [name, setName] = useState("");
  const [prompt, setPrompt] = useState("");
  const [generating, setGenerating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function handleImageChange(file: File) {
    setImage(file);
    const reader = new FileReader();
    reader.onload = (e) => setPreview((e.target?.result as string) ?? "");
    reader.readAsDataURL(file);
  }

  async function handleAutoGenerate() {
    if (!image) return;
    setGenerating(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("image", image);
      const res = await fetch("/api/ad-reference/generate-prompt", { method: "POST", body: fd });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? "Generation failed");
      }
      const data = await res.json() as { prompt: string };
      setPrompt(data.prompt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auto-generate failed");
    } finally {
      setGenerating(false);
    }
  }

  async function handleCreate() {
    if (!image || !name.trim() || !prompt.trim()) return;
    setSaving(true);
    setError(null);
    try {
      const fd = new FormData();
      fd.append("image", image);
      fd.append(
        "data",
        JSON.stringify({ label: name.trim(), brand: "winespies", generationPrompt: prompt.trim() })
      );
      const res = await fetch("/api/ad-reference/create", { method: "POST", body: fd });
      if (!res.ok) {
        const d = await res.json() as { error?: string };
        throw new Error(d.error ?? "Create failed");
      }
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create template");
      setSaving(false);
    }
  }

  const canCreate = !!image && name.trim().length > 0 && prompt.trim().length > 0;

  return (
    <div className="col-span-full border border-border rounded-xl bg-surface p-5 flex flex-col gap-4">
      <div className="text-sm font-semibold text-foreground">Add New Template</div>
      <div className="grid grid-cols-[140px_1fr] gap-4">
        {/* Image upload */}
        <div className="flex flex-col gap-2">
          <label className="block">
            <div
              className={`aspect-square rounded-lg border-2 border-dashed overflow-hidden cursor-pointer flex flex-col items-center justify-center gap-2 transition-colors ${
                preview ? "border-accent/40" : "border-border hover:border-accent/40"
              }`}
            >
              {preview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={preview} alt="Preview" className="w-full h-full object-cover" />
              ) : (
                <>
                  <svg className="w-6 h-6 text-muted/50" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                  </svg>
                  <span className="text-[10px] text-muted/60 text-center px-2">Click to upload<br/>PNG or JPG</span>
                </>
              )}
              <input
                type="file"
                accept="image/png,image/jpeg,image/webp"
                className="sr-only"
                onChange={(e) => e.target.files?.[0] && handleImageChange(e.target.files[0])}
              />
            </div>
          </label>
        </div>

        {/* Fields */}
        <div className="flex flex-col gap-3">
          <div>
            <label className="block text-[10px] font-semibold text-muted uppercase tracking-wide mb-1">
              Template Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="e.g. Lifestyle — Warm Tones"
              className="w-full px-3 py-1.5 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-accent"
            />
          </div>

          <div className="flex-1">
            <div className="flex items-center justify-between mb-1">
              <label className="text-[10px] font-semibold text-muted uppercase tracking-wide">
                Generation Prompt
              </label>
              <button
                type="button"
                onClick={handleAutoGenerate}
                disabled={!image || generating}
                className="text-[10px] text-accent hover:text-accent/80 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
              >
                {generating ? "Generating…" : "✨ Auto-generate from image"}
              </button>
            </div>
            <textarea
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              rows={8}
              placeholder={image ? "Click Auto-generate or write the Gemini prompt manually…" : "Upload an image first, then auto-generate or write manually…"}
              className="w-full px-3 py-2 text-xs font-mono border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-accent resize-y"
            />
          </div>

          {error && <div className="text-xs text-danger">{error}</div>}

          <div className="flex items-center justify-end gap-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-3 py-1.5 text-xs text-muted hover:text-foreground transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleCreate}
              disabled={!canCreate || saving}
              className="px-4 py-1.5 text-xs font-semibold bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {saving ? "Creating…" : "Create Template"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── StyleSelector ────────────────────────────────────────────────────────────

interface StyleSelectorProps {
  styles: AdStyle[];
  loading: boolean;
  error: string | null;
  selected: string[];
  onToggle: (id: string) => void;
  onBack: () => void;
  onNext: () => void;
  selectedWineCount: number;
  onStylesRefresh: () => void;
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
  onStylesRefresh,
}: StyleSelectorProps) {
  const totalAds = selectedWineCount * selected.length;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [addingTemplate, setAddingTemplate] = useState(false);

  const toggleEdit = useCallback((id: string) => {
    setEditingId((prev) => (prev === id ? null : id));
  }, []);

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

      {!loading && !error && (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {styles.map((style) => (
            <Fragment key={style.id}>
              <StyleCard
                style={style}
                selected={selected.includes(style.id)}
                isEditing={editingId === style.id}
                onToggle={() => onToggle(style.id)}
                onEditPrompt={() => toggleEdit(style.id)}
              />
              {editingId === style.id && (
                <PromptEditorPanel
                  styleId={style.id}
                  styleName={style.name}
                  onClose={() => setEditingId(null)}
                />
              )}
            </Fragment>
          ))}

          {addingTemplate ? null : (
            <AddTemplateCard onClick={() => setAddingTemplate(true)} />
          )}
          {addingTemplate && (
            <AddTemplateForm
              onCancel={() => setAddingTemplate(false)}
              onCreated={() => {
                setAddingTemplate(false);
                onStylesRefresh();
              }}
            />
          )}
        </div>
      )}
    </div>
  );
}
