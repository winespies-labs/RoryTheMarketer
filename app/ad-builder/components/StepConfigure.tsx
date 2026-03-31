"use client";

import { useState } from "react";
import type {
  WineDetails,
  AspectRatio,
  ImageBackend,
  CopyVariation,
} from "@/lib/ad-builder";
import { ASPECT_RATIO_CONFIG } from "@/lib/ad-builder";
import ImageUploadZone from "./ImageUploadZone";
import DynamicDetailsForm from "./DynamicDetailsForm";
import BrandAssetPicker from "./BrandAssetPicker";
import SaveToLibraryButton from "./SaveToLibraryButton";
import type { AssetCategory } from "@/lib/brand-assets";

type ReferenceAdSummary = {
  id: string;
  label: string;
  angle?: string;
  nanoBanana?: string;
  imageFile?: string;
};

interface StepConfigureProps {
  brandId: string;
  selectedAds: ReferenceAdSummary[];
  // Images
  bottleFiles: File[];
  bottlePreviews: string[];
  onBottleSelect: (file: File) => void;
  onBottleRemove: (index: number) => void;
  bgFile: File | null;
  bgPreview?: string;
  onBgSelect: (file: File) => void;
  onBgClear: () => void;
  // Wine details
  details: WineDetails;
  onDetailsChange: (d: WineDetails) => void;
  // Copy variations
  copyVariations: Record<string, CopyVariation[]>;
  onCopyVariationsChange: (v: Record<string, CopyVariation[]>) => void;
  copyGenerating: boolean;
  copyError: string;
  onGenerateCopy: () => void;
  // Image settings
  backend: ImageBackend;
  onBackendChange: (b: ImageBackend) => void;
  aspectRatio: AspectRatio;
  onAspectRatioChange: (ar: AspectRatio) => void;
  imagesPerPrompt: number;
  onImagesPerPromptChange: (n: number) => void;
  imagePromptModifier: string;
  onImagePromptModifierChange: (m: string) => void;
  onSaveModifier: () => void;
  // Actions
  onGenerate: () => void;
  onBack: () => void;
  generating: boolean;
}

export default function StepConfigure({
  brandId,
  selectedAds,
  bottleFiles,
  bottlePreviews,
  onBottleSelect,
  onBottleRemove,
  bgPreview,
  onBgSelect,
  onBgClear,
  details,
  onDetailsChange,
  copyVariations,
  onCopyVariationsChange,
  copyGenerating,
  copyError,
  onGenerateCopy,
  backend,
  onBackendChange,
  aspectRatio,
  onAspectRatioChange,
  imagesPerPrompt,
  onImagesPerPromptChange,
  imagePromptModifier,
  onImagePromptModifierChange,
  onSaveModifier,
  onGenerate,
  onBack,
  generating,
}: StepConfigureProps) {
  const [pickerOpen, setPickerOpen] = useState<AssetCategory | null>(null);

  const handleAssetSelect = async (asset: { id: string; label: string; url: string }) => {
    const targetCategory = pickerOpen;
    setPickerOpen(null);
    try {
      const res = await fetch(asset.url);
      const blob = await res.blob();
      const ext = blob.type.split("/")[1] || "png";
      const file = new File([blob], `${asset.label}.${ext}`, { type: blob.type });
      if (targetCategory === "background") {
        onBgSelect(file);
      } else {
        onBottleSelect(file);
      }
    } catch {
      // ignore
    }
  };

  // Count total copy variations
  const totalCopyVariations = Object.values(copyVariations).reduce(
    (sum, arr) => sum + arr.length,
    0,
  );

  // Calculate total ads to generate
  const multiplier = backend === "fal" ? imagesPerPrompt : 1;
  const copyCount = totalCopyVariations || selectedAds.length;
  const totalAds = copyCount * multiplier;

  const canGenerate = bottleFiles.length > 0 && (totalCopyVariations > 0 || details.headline.trim());

  // Edit a specific copy variation
  const handleEditVariation = (
    refId: string,
    idx: number,
    field: keyof CopyVariation,
    value: string,
  ) => {
    const updated = { ...copyVariations };
    if (!updated[refId]) return;
    updated[refId] = updated[refId].map((v, i) =>
      i === idx ? { ...v, [field]: value } : v,
    );
    onCopyVariationsChange(updated);
  };

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-muted hover:text-foreground transition-colors"
      >
        ← Back to Select
      </button>

      {/* Selected templates strip */}
      <div className="flex gap-2 overflow-x-auto pb-2">
        {selectedAds.map((ad) => (
          <div
            key={ad.id}
            className="flex-shrink-0 w-16 h-16 rounded-lg border border-border overflow-hidden"
            title={ad.label}
          >
            {ad.imageFile ? (
              <img
                src={`/api/ad-reference/image?id=${ad.id}`}
                alt={ad.label}
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full bg-background flex items-center justify-center text-[8px] text-muted">
                {ad.label.slice(0, 6)}
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Images section */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-sm font-medium text-foreground mb-4">Images</h2>

        {/* Product / Bottle images */}
        <div className="mb-4">
          <label className="block text-xs font-medium text-muted mb-2">
            Product Images (required)
          </label>
          <div className="flex flex-wrap gap-3">
            {bottlePreviews.map((url, idx) => (
              <div
                key={idx}
                className="group relative w-24 h-24 rounded-lg border border-border bg-background overflow-hidden"
              >
                <img
                  src={url}
                  alt={`Bottle ${idx + 1}`}
                  className="w-full h-full object-contain"
                />
                <button
                  type="button"
                  onClick={() => onBottleRemove(idx)}
                  className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full bg-surface border border-border text-muted hover:text-foreground text-[10px]"
                >
                  x
                </button>
                {/* Save to library */}
                <div className="absolute bottom-1 right-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <SaveToLibraryButton
                    brandId={brandId}
                    file={bottleFiles[idx]}
                    defaultCategory="product"
                  />
                </div>
              </div>
            ))}
            <ImageUploadZone
              label={bottleFiles.length === 0 ? "Add Bottle" : "+"}
              onFileSelect={onBottleSelect}
              onClear={() => {}}
              compact={bottleFiles.length > 0}
            />
            {/* Library button */}
            <button
              type="button"
              onClick={() => setPickerOpen("product")}
              className="w-24 h-24 rounded-lg border-2 border-dashed border-border hover:border-accent/50 bg-background flex flex-col items-center justify-center gap-1 text-muted hover:text-accent transition-colors"
              title="Browse asset library"
            >
              <span className="text-lg">📁</span>
              <span className="text-[10px] font-medium">Library</span>
            </button>
          </div>
        </div>

        {/* Background image */}
        <div>
          <label className="block text-xs font-medium text-muted mb-2">
            Background (optional)
          </label>
          <div className="flex gap-3 items-start">
            <div className="flex-1">
              <ImageUploadZone
                label="Background"
                onFileSelect={onBgSelect}
                previewUrl={bgPreview}
                onClear={onBgClear}
              />
            </div>
            <button
              type="button"
              onClick={() => setPickerOpen("background")}
              className="w-24 h-24 rounded-lg border-2 border-dashed border-border hover:border-accent/50 bg-background flex flex-col items-center justify-center gap-1 text-muted hover:text-accent transition-colors flex-shrink-0"
              title="Browse background assets"
            >
              <span className="text-lg">📁</span>
              <span className="text-[10px] font-medium">Library</span>
            </button>
          </div>
        </div>
      </div>

      {/* Details form */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <h2 className="text-sm font-medium text-foreground mb-4">
          Wine Details
        </h2>
        <DynamicDetailsForm
          details={details}
          onChange={onDetailsChange}
        />
      </div>

      {/* Copy generation */}
      <div className="rounded-xl border border-border bg-surface p-6 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-medium text-foreground">
            Ad Copy
          </h2>
          <button
            type="button"
            onClick={onGenerateCopy}
            disabled={copyGenerating}
            className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {copyGenerating
              ? "Generating..."
              : `Generate Copy (${selectedAds.length} template${selectedAds.length !== 1 ? "s" : ""})`}
          </button>
        </div>

        {copyError && (
          <p className="text-sm text-danger bg-red-50 border border-red-200 rounded-lg p-3">
            {copyError}
          </p>
        )}

        {/* Copy variation cards grouped by reference ad */}
        {Object.entries(copyVariations).map(([refId, vars]) => {
          const ad = selectedAds.find((a) => a.id === refId);
          if (!vars.length) return null;
          return (
            <div key={refId} className="border border-border rounded-lg p-4 space-y-3">
              <p className="text-xs font-semibold text-foreground">
                {ad?.label ?? refId}
              </p>
              {vars.map((v, idx) => (
                <div
                  key={idx}
                  className="border-b last:border-b-0 border-border/60 pb-3 last:pb-0 space-y-2"
                >
                  <p className="text-[10px] font-medium text-muted uppercase tracking-wide">
                    Variation {idx + 1}
                  </p>
                  <input
                    type="text"
                    value={v.headline}
                    onChange={(e) =>
                      handleEditVariation(refId, idx, "headline", e.target.value)
                    }
                    className="w-full px-2 py-1 text-xs border border-border rounded bg-background"
                    placeholder="Headline"
                  />
                  <textarea
                    value={v.primaryText}
                    onChange={(e) =>
                      handleEditVariation(refId, idx, "primaryText", e.target.value)
                    }
                    className="w-full px-2 py-1 text-xs border border-border rounded bg-background resize-y"
                    rows={3}
                    placeholder="Primary text"
                  />
                  <input
                    type="text"
                    value={v.description}
                    onChange={(e) =>
                      handleEditVariation(refId, idx, "description", e.target.value)
                    }
                    className="w-full px-2 py-1 text-xs border border-border rounded bg-background"
                    placeholder="Description"
                  />
                </div>
              ))}
            </div>
          );
        })}
      </div>

      {/* Image settings */}
      <div className="rounded-xl border border-border bg-surface p-6 space-y-4">
        <h2 className="text-sm font-medium text-foreground mb-2">
          Image Settings
        </h2>

        {/* Backend picker */}
        <div>
          <label className="block text-xs font-medium text-muted mb-1.5">
            Image Backend
          </label>
          <div className="flex gap-2">
            {(["gemini", "fal"] as ImageBackend[]).map((b) => (
              <button
                key={b}
                type="button"
                onClick={() => onBackendChange(b)}
                className={`px-4 py-2 text-sm font-medium rounded-lg border transition-colors ${
                  backend === b
                    ? "bg-accent text-white border-accent"
                    : "bg-background text-foreground border-border hover:border-accent/50"
                }`}
              >
                {b === "gemini" ? "Gemini" : "FAL (Nano Banana 2)"}
              </button>
            ))}
          </div>
        </div>

        {/* Aspect ratio */}
        <div>
          <label className="block text-xs font-medium text-muted mb-1.5">
            Aspect Ratio
          </label>
          <div className="flex gap-2">
            {(Object.keys(ASPECT_RATIO_CONFIG) as AspectRatio[]).map((ar) => (
              <button
                key={ar}
                type="button"
                onClick={() => onAspectRatioChange(ar)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                  aspectRatio === ar
                    ? "bg-accent text-white border-accent"
                    : "bg-background text-foreground border-border hover:border-accent/50"
                }`}
              >
                {ASPECT_RATIO_CONFIG[ar].label}
              </button>
            ))}
          </div>
        </div>

        {/* Images per prompt (FAL only) */}
        {backend === "fal" && (
          <div>
            <label className="block text-xs font-medium text-muted mb-1.5">
              Images per Prompt (1-4)
            </label>
            <div className="flex gap-2">
              {[1, 2, 3, 4].map((n) => (
                <button
                  key={n}
                  type="button"
                  onClick={() => onImagesPerPromptChange(n)}
                  className={`w-10 h-10 text-sm font-medium rounded-lg border transition-colors ${
                    imagesPerPrompt === n
                      ? "bg-accent text-white border-accent"
                      : "bg-background text-foreground border-border hover:border-accent/50"
                  }`}
                >
                  {n}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Image prompt modifier */}
        <div>
          <label className="block text-xs font-medium text-muted mb-1.5">
            Image Prompt Modifier{" "}
            <span className="text-[10px] text-muted">(50-75 words)</span>
          </label>
          <textarea
            value={imagePromptModifier}
            onChange={(e) => onImagePromptModifierChange(e.target.value)}
            placeholder="Describe the brand's visual identity — colors, typography style, mood, lighting preferences..."
            rows={3}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background resize-y"
          />
          <button
            type="button"
            onClick={onSaveModifier}
            className="mt-1 text-xs text-accent hover:underline"
          >
            Save to brand context
          </button>
        </div>
      </div>

      {/* Generate button */}
      <button
        type="button"
        onClick={onGenerate}
        disabled={!canGenerate || generating}
        className="w-full px-4 py-3 text-sm font-medium bg-accent text-white rounded-xl hover:opacity-90 transition-opacity disabled:opacity-50"
      >
        {generating
          ? "Generating..."
          : `Generate ${totalAds} ad${totalAds !== 1 ? "s" : ""}`}
      </button>

      {/* Brand Asset Picker */}
      {pickerOpen && (
        <BrandAssetPicker
          brandId={brandId}
          filterCategory={pickerOpen}
          onSelect={handleAssetSelect}
          onClose={() => setPickerOpen(null)}
        />
      )}
    </div>
  );
}
