"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import type { AspectRatio } from "@/lib/ad-builder";

type ReferenceAdMeta = {
  id: string;
  label: string;
  imageFile?: string;
  type?: string;
  aspectRatio?: string;
};

export type TemplatePickerResult = {
  mode: "basic" | "templated";
  referenceIds: string[];
  aspectRatio: AspectRatio;
  imagePromptModifier: string;
};

type Props = {
  wineCount: number;
  onConfirm: (result: TemplatePickerResult) => void;
  onBack: () => void;
};

export default function TemplatePicker({ wineCount, onConfirm, onBack }: Props) {
  const [mode, setMode] = useState<"basic" | "templated">("basic");
  const [referenceAds, setReferenceAds] = useState<ReferenceAdMeta[]>([]);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [imagePromptModifier, setImagePromptModifier] = useState("");
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (mode === "templated") {
      setLoading(true);
      fetch("/api/ad-reference/list?brand=winespies")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data)) setReferenceAds(data);
        })
        .catch(() => {})
        .finally(() => setLoading(false));
    }
  }, [mode]);

  const toggleRef = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const totalAds =
    mode === "basic"
      ? wineCount
      : wineCount * Math.max(selectedIds.length, 1);

  const canConfirm = mode === "basic" || selectedIds.length > 0;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        {/* Mode toggle */}
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">
            Generation Mode
          </label>
          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setMode("basic")}
              className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                mode === "basic"
                  ? "bg-accent text-white border-accent"
                  : "bg-surface border-border hover:bg-background"
              }`}
            >
              Basic
            </button>
            <button
              type="button"
              onClick={() => setMode("templated")}
              className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                mode === "templated"
                  ? "bg-accent text-white border-accent"
                  : "bg-surface border-border hover:bg-background"
              }`}
            >
              Templated
            </button>
          </div>
        </div>

        {mode === "basic" ? (
          <div className="bg-background border border-border rounded-lg p-4">
            <h3 className="text-sm font-semibold mb-1">Basic Mode</h3>
            <p className="text-xs text-muted">
              Uses each wine&apos;s bottle photo as the ad image. Generates ad copy via Claude.
              Fast — no image generation needed.
            </p>
            <div className="mt-3 text-sm font-medium text-accent">
              {wineCount} wine{wineCount !== 1 ? "s" : ""} → {wineCount} ad
              {wineCount !== 1 ? "s" : ""} (bottle photo + generated copy)
            </div>
          </div>
        ) : (
          <>
            <div className="bg-background border border-border rounded-lg p-4">
              <h3 className="text-sm font-semibold mb-1">Templated Mode</h3>
              <p className="text-xs text-muted">
                Select reference ad template(s). Each wine gets a styled ad image generated
                via Gemini for every selected template.
              </p>
              <div className="mt-3 text-sm font-medium text-accent">
                {wineCount} wine{wineCount !== 1 ? "s" : ""} × {selectedIds.length} template
                {selectedIds.length !== 1 ? "s" : ""} = {totalAds} ad{totalAds !== 1 ? "s" : ""}
              </div>
            </div>

            {/* Reference ad grid */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Select Template(s)
              </label>
              {loading ? (
                <p className="text-sm text-muted">Loading templates...</p>
              ) : referenceAds.length === 0 ? (
                <p className="text-sm text-muted">
                  No reference ads found. Create them in the Ad Builder first.
                </p>
              ) : (
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
                  {referenceAds.map((ad) => {
                    const selected = selectedIds.includes(ad.id);
                    return (
                      <button
                        key={ad.id}
                        type="button"
                        onClick={() => toggleRef(ad.id)}
                        className={`relative rounded-lg border-2 overflow-hidden text-left transition-colors ${
                          selected
                            ? "border-accent ring-2 ring-accent/30"
                            : "border-border hover:border-accent/50"
                        }`}
                      >
                        <div className="aspect-square bg-background relative">
                          {ad.imageFile ? (
                            <Image
                              src={`/api/ad-reference/image?id=${ad.id}`}
                              alt={ad.label}
                              fill
                              className="object-cover"
                              sizes="200px"
                              unoptimized
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full text-muted text-xs">
                              No image
                            </div>
                          )}
                          {selected && (
                            <div className="absolute top-1 right-1 w-5 h-5 bg-accent rounded-full flex items-center justify-center">
                              <svg
                                className="w-3 h-3 text-white"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={3}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="p-2">
                          <div className="text-xs font-medium truncate">
                            {ad.label}
                          </div>
                          {ad.type && (
                            <div className="text-[10px] text-muted mt-0.5">
                              {ad.type}
                            </div>
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
              )}
            </div>

            {/* Aspect ratio */}
            <div>
              <label className="text-sm font-medium text-foreground mb-2 block">
                Aspect Ratio
              </label>
              <div className="flex gap-2">
                {(["1:1", "4:5", "9:16", "16:9"] as AspectRatio[]).map((ar) => (
                  <button
                    key={ar}
                    type="button"
                    onClick={() => setAspectRatio(ar)}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                      aspectRatio === ar
                        ? "bg-accent text-white border-accent"
                        : "bg-surface border-border hover:bg-background"
                    }`}
                  >
                    {ar}
                  </button>
                ))}
              </div>
            </div>

            {/* Image prompt modifier */}
            <div>
              <label className="text-sm font-medium text-foreground mb-1 block">
                Image Prompt Modifier{" "}
                <span className="text-muted font-normal">(optional)</span>
              </label>
              <textarea
                value={imagePromptModifier}
                onChange={(e) => setImagePromptModifier(e.target.value)}
                rows={3}
                placeholder="Additional visual instructions for image generation..."
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-surface resize-none"
              />
            </div>
          </>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border p-4 flex justify-between items-center">
        <button
          type="button"
          onClick={onBack}
          className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-background transition-colors"
        >
          Back
        </button>
        <button
          type="button"
          disabled={!canConfirm}
          onClick={() =>
            onConfirm({
              mode,
              referenceIds: selectedIds,
              aspectRatio,
              imagePromptModifier,
            })
          }
          className="px-6 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
        >
          Generate {totalAds} Ad{totalAds !== 1 ? "s" : ""}
        </button>
      </div>
    </div>
  );
}
