"use client";

import { useState, useCallback } from "react";
import { nanoid } from "nanoid";
import TemplatePicker, { type TemplatePickerResult } from "./TemplatePicker";
import BatchResults, { type GeneratedAdResult } from "./BatchResults";
import PublishPanel from "./PublishPanel";

type WineForBulk = {
  id: number;
  wineName: string;
  saleId: number;
  bottleImageUrl: string;
  wineDetails: {
    headline: string;
    retailPrice: string;
    salePrice: string;
    pullQuote: string;
    productName: string;
    ctaText: string;
    additionalNotes: string;
  };
};

type Step = "TEMPLATE_PICK" | "GENERATING" | "RESULTS" | "PUBLISH";

type Props = {
  wines: WineForBulk[];
  onClose: () => void;
};

export default function BulkAdModal({ wines, onClose }: Props) {
  const [step, setStep] = useState<Step>("TEMPLATE_PICK");
  const [templateConfig, setTemplateConfig] = useState<TemplatePickerResult | null>(null);
  const [results, setResults] = useState<GeneratedAdResult[]>([]);
  const [generatingIdx, setGeneratingIdx] = useState(0);
  const [totalToGenerate, setTotalToGenerate] = useState(0);
  const [genError, setGenError] = useState<string | null>(null);

  const handleTemplateConfirm = useCallback(
    async (config: TemplatePickerResult) => {
      setTemplateConfig(config);
      setStep("GENERATING");
      setGenError(null);

      // Build generation tasks
      type Task = { wine: WineForBulk; referenceId?: string };
      const tasks: Task[] = [];

      if (config.mode === "basic") {
        for (const wine of wines) {
          tasks.push({ wine });
        }
      } else {
        for (const wine of wines) {
          for (const refId of config.referenceIds) {
            tasks.push({ wine, referenceId: refId });
          }
        }
      }

      setTotalToGenerate(tasks.length);
      const generated: GeneratedAdResult[] = [];

      for (let i = 0; i < tasks.length; i++) {
        setGeneratingIdx(i + 1);
        const task = tasks[i];

        try {
          const res = await fetch("/api/wines/generate-single", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              brand: "winespies",
              mode: config.mode,
              wineDetails: task.wine.wineDetails,
              bottleImageUrl: task.wine.bottleImageUrl,
              saleId: task.wine.saleId,
              wineName: task.wine.wineName,
              referenceId: task.referenceId,
              aspectRatio: config.aspectRatio,
              imagePromptModifier: config.imagePromptModifier,
            }),
          });

          const data = await res.json();

          if (!res.ok) {
            generated.push({
              id: nanoid(),
              wineName: task.wine.wineName,
              saleId: task.wine.saleId,
              mode: config.mode,
              copyVariation: {
                primaryText: "",
                headline: data.error ?? "Generation failed",
                description: "",
              },
              imageBase64: "",
              imageMimeType: "",
              destinationUrl: `https://winespies.com/sales/${task.wine.saleId}`,
              referenceId: task.referenceId,
              selected: false,
            });
            continue;
          }

          generated.push({
            id: nanoid(),
            wineName: data.wineName,
            saleId: data.saleId,
            mode: data.mode,
            copyVariation: data.copyVariation,
            imageBase64: data.imageBase64,
            imageMimeType: data.imageMimeType,
            destinationUrl: data.destinationUrl,
            referenceId: task.referenceId,
            selected: true,
          });
        } catch (err) {
          generated.push({
            id: nanoid(),
            wineName: task.wine.wineName,
            saleId: task.wine.saleId,
            mode: config.mode,
            copyVariation: {
              primaryText: "",
              headline: err instanceof Error ? err.message : "Network error",
              description: "",
            },
            imageBase64: "",
            imageMimeType: "",
            destinationUrl: `https://winespies.com/sales/${task.wine.saleId}`,
            referenceId: task.referenceId,
            selected: false,
          });
        }
      }

      setResults(generated);
      setStep("RESULTS");
    },
    [wines],
  );

  const handleUpdateResult = (id: string, updates: Partial<GeneratedAdResult>) => {
    setResults((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates } : r)),
    );
  };

  const handleToggleSelect = (id: string) => {
    setResults((prev) =>
      prev.map((r) => (r.id === id ? { ...r, selected: !r.selected } : r)),
    );
  };

  const handleToggleAll = (selected: boolean) => {
    setResults((prev) =>
      prev.map((r) => (r.imageBase64 ? { ...r, selected } : r)),
    );
  };

  const selectedAds = results.filter((r) => r.selected && r.imageBase64);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/50"
        onClick={step !== "GENERATING" ? onClose : undefined}
      />

      {/* Modal */}
      <div className="relative w-full max-w-4xl max-h-[90vh] bg-surface rounded-xl shadow-2xl flex flex-col overflow-hidden mx-4">
        {/* Header */}
        <div className="border-b border-border px-6 py-4 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-semibold">Bulk Ad Builder</h2>
            <p className="text-xs text-muted mt-0.5">
              {wines.length} wine{wines.length !== 1 ? "s" : ""} selected
            </p>
          </div>
          {step !== "GENERATING" && (
            <button
              type="button"
              onClick={onClose}
              className="text-muted hover:text-foreground transition-colors"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>

        {/* Step indicator */}
        <div className="px-6 py-2 border-b border-border flex gap-4 text-xs shrink-0">
          {(
            [
              { key: "TEMPLATE_PICK", label: "1. Configure" },
              { key: "GENERATING", label: "2. Generate" },
              { key: "RESULTS", label: "3. Review" },
              { key: "PUBLISH", label: "4. Publish" },
            ] as const
          ).map((s) => (
            <span
              key={s.key}
              className={`font-medium ${
                step === s.key ? "text-accent" : "text-muted"
              }`}
            >
              {s.label}
            </span>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-hidden">
          {step === "TEMPLATE_PICK" && (
            <TemplatePicker
              wineCount={wines.length}
              onConfirm={handleTemplateConfirm}
              onBack={onClose}
            />
          )}

          {step === "GENERATING" && (
            <div className="flex flex-col items-center justify-center h-full p-6 space-y-4">
              <svg
                className="animate-spin h-8 w-8 text-accent"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
              <div className="text-center">
                <div className="text-sm font-medium">
                  Generating {generatingIdx} of {totalToGenerate}...
                </div>
                <div className="text-xs text-muted mt-1">
                  {templateConfig?.mode === "basic"
                    ? "Generating copy for each wine..."
                    : "Generating copy + styled images..."}
                </div>
              </div>
              {/* Progress bar */}
              <div className="w-64 h-2 bg-border rounded-full overflow-hidden">
                <div
                  className="h-full bg-accent rounded-full transition-all duration-300"
                  style={{
                    width: `${totalToGenerate > 0 ? (generatingIdx / totalToGenerate) * 100 : 0}%`,
                  }}
                />
              </div>
              {genError && (
                <div className="text-xs text-danger">{genError}</div>
              )}
            </div>
          )}

          {step === "RESULTS" && (
            <BatchResults
              results={results}
              onUpdateResult={handleUpdateResult}
              onToggleSelect={handleToggleSelect}
              onToggleAll={handleToggleAll}
              onPublish={() => setStep("PUBLISH")}
              onBack={() => setStep("TEMPLATE_PICK")}
            />
          )}

          {step === "PUBLISH" && (
            <PublishPanel
              ads={selectedAds}
              onBack={() => setStep("RESULTS")}
              onDone={onClose}
            />
          )}
        </div>
      </div>
    </div>
  );
}
