"use client";

import { useState, useRef, useCallback } from "react";
import type { AspectRatio } from "@/lib/ad-builder";
import { ASPECT_RATIO_CONFIG } from "@/lib/ad-builder";

type ReferenceAdDetail = {
  id?: string;
  label: string;
  brand: string;
  aspectRatio?: AspectRatio;
  adDescription?: string;
  generationPrompt?: string;
  imageFile?: string;
  // Legacy fields for backward compat when loading old ads
  primaryText?: string;
  headline?: string;
  description?: string;
  visualNotes?: string;
  promptGuidance?: string;
};

interface ReferenceAdEditorProps {
  mode: "create" | "edit";
  referenceAd?: ReferenceAdDetail;
  brandId: string;
  onSave: () => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
}

const ASPECT_RATIOS: AspectRatio[] = ["1:1", "4:5", "9:16", "16:9"];

function buildFallbackDescription(ad: ReferenceAdDetail): string {
  if (ad.adDescription) return ad.adDescription;
  const parts: string[] = [];
  if (ad.visualNotes) parts.push(`Visual Layout:\n${ad.visualNotes}`);
  if (ad.primaryText) parts.push(`Primary Text:\n${ad.primaryText}`);
  if (ad.headline) parts.push(`Headline:\n${ad.headline}`);
  if (ad.description) parts.push(`Description:\n${ad.description}`);
  if (ad.promptGuidance) parts.push(`Prompt Guidance:\n${ad.promptGuidance}`);
  return parts.join("\n\n");
}

export default function ReferenceAdEditor({
  mode,
  referenceAd,
  brandId,
  onSave,
  onDelete,
  onClose,
}: ReferenceAdEditorProps) {
  // Form state
  const [label, setLabel] = useState(referenceAd?.label || "");
  const [aspectRatio, setAspectRatio] = useState<AspectRatio | undefined>(
    referenceAd?.aspectRatio,
  );
  const [adDescription, setAdDescription] = useState(
    referenceAd ? buildFallbackDescription(referenceAd) : "",
  );
  const [generationPrompt, setGenerationPrompt] = useState(
    referenceAd?.generationPrompt || "",
  );

  // Image state
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [imagePreview, setImagePreview] = useState<string | undefined>(
    referenceAd?.imageFile && referenceAd?.id
      ? `/api/ad-reference/image?id=${referenceAd.id}`
      : undefined,
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  // UI state
  const [saving, setSaving] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [buildingPrompt, setBuildingPrompt] = useState(false);
  const [error, setError] = useState("");

  const handleImageSelect = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      setImageFile(file);
      setImagePreview(URL.createObjectURL(file));
    },
    [],
  );

  const handleBuildPrompt = async () => {
    const imgToAnalyze = imageFile;
    if (!imgToAnalyze && !imagePreview) {
      setError("Upload an image first to analyze it.");
      return;
    }

    setBuildingPrompt(true);
    setError("");

    try {
      let fileToSend: File;
      if (imgToAnalyze) {
        fileToSend = imgToAnalyze;
      } else {
        const res = await fetch(
          `/api/ad-reference/image?id=${referenceAd?.id}`,
        );
        const blob = await res.blob();
        fileToSend = new File([blob], "image.png", { type: blob.type });
      }

      const fd = new FormData();
      fd.append("image", fileToSend);
      fd.append("label", label);
      fd.append("brand", brandId);

      const res = await fetch("/api/ad-reference/build-prompt", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || "Failed to analyze image");
        return;
      }

      if (data.adDescription) setAdDescription(data.adDescription);
      if (data.generationPrompt) setGenerationPrompt(data.generationPrompt);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to analyze image");
    } finally {
      setBuildingPrompt(false);
    }
  };

  const handleSave = async () => {
    if (!label.trim()) {
      setError("Label is required.");
      return;
    }
    if (mode === "create" && !imageFile) {
      setError("Image is required for new reference ads.");
      return;
    }

    setSaving(true);
    setError("");

    try {
      const inputData = {
        label: label.trim(),
        brand: brandId,
        aspectRatio,
        adDescription: adDescription.trim() || undefined,
        generationPrompt: generationPrompt.trim() || undefined,
      };

      if (mode === "create") {
        const fd = new FormData();
        fd.append("image", imageFile!);
        fd.append("data", JSON.stringify(inputData));

        const res = await fetch("/api/ad-reference/create", {
          method: "POST",
          body: fd,
        });
        const data = await res.json();
        if (!res.ok) {
          setError(data.error || "Failed to create");
          return;
        }
      } else {
        if (imageFile) {
          const fd = new FormData();
          fd.append("image", imageFile);
          fd.append(
            "data",
            JSON.stringify({ ...inputData, id: referenceAd!.id }),
          );

          const res = await fetch("/api/ad-reference/update", {
            method: "PUT",
            body: fd,
          });
          const data = await res.json();
          if (!res.ok) {
            setError(data.error || "Failed to update");
            return;
          }
        } else {
          const res = await fetch("/api/ad-reference/update", {
            method: "PUT",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ ...inputData, id: referenceAd!.id }),
          });
          const data = await res.json();
          if (!res.ok) {
            setError(data.error || "Failed to update");
            return;
          }
        }
      }

      onSave();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Save failed");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirmDelete) {
      setConfirmDelete(true);
      return;
    }

    setDeleting(true);
    try {
      const res = await fetch(
        `/api/ad-reference/delete?id=${referenceAd!.id}`,
        { method: "DELETE" },
      );
      if (!res.ok) {
        const data = await res.json();
        setError(data.error || "Failed to delete");
        return;
      }
      onDelete?.(referenceAd!.id!);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Delete failed");
    } finally {
      setDeleting(false);
      setConfirmDelete(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="w-full max-w-2xl bg-surface border-l border-border overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-surface border-b border-border px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-semibold">
            {mode === "create" ? "New Reference Ad" : `Edit: ${referenceAd?.label}`}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-foreground text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="p-6 space-y-6">
          {/* Image Section */}
          <div>
            <label className="block text-sm font-medium mb-2">
              Ad Image {mode === "create" && <span className="text-red-500">*</span>}
            </label>
            <div className="flex items-start gap-4">
              <div className="w-40 h-40 rounded-lg border border-border bg-background flex items-center justify-center overflow-hidden flex-shrink-0">
                {imagePreview ? (
                  <img
                    src={imagePreview}
                    alt="Preview"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <span className="text-muted text-xs">No image</span>
                )}
              </div>
              <div className="flex flex-col gap-2">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  onChange={handleImageSelect}
                  className="hidden"
                />
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="px-3 py-1.5 text-xs font-medium bg-background border border-border rounded-lg hover:border-accent/50 transition-colors"
                >
                  {imagePreview ? "Replace Image" : "Upload Image"}
                </button>
                <button
                  type="button"
                  onClick={handleBuildPrompt}
                  disabled={buildingPrompt || (!imageFile && !imagePreview)}
                  className="px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  {buildingPrompt ? "Analyzing..." : "Analyze Image"}
                </button>
              </div>
            </div>
          </div>

          {/* Label */}
          <div>
            <label className="block text-xs font-medium mb-1">
              Label <span className="text-red-500">*</span>
            </label>
            <input
              type="text"
              value={label}
              onChange={(e) => setLabel(e.target.value)}
              placeholder="e.g. Wine Spies – PDP Cult 1"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:border-accent"
            />
          </div>

          {/* Aspect Ratio */}
          <div>
            <label className="block text-xs font-medium mb-1.5">
              Aspect Ratio
            </label>
            <div className="flex flex-wrap gap-1.5">
              {ASPECT_RATIOS.map((ar) => {
                const config = ASPECT_RATIO_CONFIG[ar];
                const isActive = aspectRatio === ar;
                return (
                  <button
                    key={ar}
                    type="button"
                    onClick={() => setAspectRatio(isActive ? undefined : ar)}
                    className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors ${
                      isActive
                        ? "bg-accent text-white border-accent"
                        : "bg-background text-muted border-border hover:border-accent/50"
                    }`}
                  >
                    {config.label}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Generation Prompt */}
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="block text-xs font-medium">
                Generation Prompt
              </label>
              <div className="flex items-center gap-2">
                {generationPrompt && (
                  <span className="text-[10px] text-success font-medium">Ready</span>
                )}
                <button
                  type="button"
                  onClick={handleBuildPrompt}
                  disabled={buildingPrompt || (!imageFile && !imagePreview)}
                  className="px-2.5 py-1 text-[11px] font-medium bg-accent text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40"
                >
                  {buildingPrompt ? "Analyzing…" : "Generate with AI"}
                </button>
              </div>
            </div>
            <p className="text-[10px] text-muted mb-2">
              The complete Nano Banana 2 prompt sent to Gemini at generation time. Use{" "}
              <code className="font-mono bg-background px-1 rounded">{"{{wineName}}"}</code>,{" "}
              <code className="font-mono bg-background px-1 rounded">{"{{score}}"}</code>,{" "}
              <code className="font-mono bg-background px-1 rounded">{"{{salePrice}}"}</code>,{" "}
              <code className="font-mono bg-background px-1 rounded">{"{{retailPrice}}"}</code>,{" "}
              <code className="font-mono bg-background px-1 rounded">{"{{ctaText}}"}</code>,{" "}
              <code className="font-mono bg-background px-1 rounded">{"{{pullQuote}}"}</code> for dynamic wine data.
            </p>
            <textarea
              value={generationPrompt}
              onChange={(e) => setGenerationPrompt(e.target.value)}
              rows={14}
              placeholder="Click 'Analyze Image' to auto-generate this prompt, or write it manually. Be explicit about hex colors, pixel dimensions, and border-radius values."
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:border-accent resize-y font-mono text-xs"
            />
          </div>

          {/* Error */}
          {error && (
            <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              {error}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="sticky bottom-0 bg-surface border-t border-border px-6 py-4 flex items-center justify-between">
          <div>
            {mode === "edit" && onDelete && (
              <button
                type="button"
                onClick={handleDelete}
                disabled={deleting}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-colors ${
                  confirmDelete
                    ? "bg-red-600 text-white hover:bg-red-700"
                    : "text-red-600 border border-red-300 hover:bg-red-50"
                }`}
              >
                {deleting
                  ? "Deleting..."
                  : confirmDelete
                    ? "Confirm Delete"
                    : "Delete"}
              </button>
            )}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-sm font-medium text-muted border border-border rounded-lg hover:bg-background transition-colors"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-5 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
