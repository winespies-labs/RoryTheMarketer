"use client";

import { useCallback, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";
import { Suspense } from "react";

import { useFeed } from "./hooks/useFeed";
import { useBatchMapping } from "./hooks/useBatchMapping";
import { useGenerator } from "./hooks/useGenerator";

import WineSelector from "./components/WineSelector";
import TemplateSelector from "./components/TemplateSelector";
import ReviewBrief from "./components/ReviewBrief";
import GenerationQueue from "./components/GenerationQueue";
import PublishPanel from "./components/PublishPanel";

// ── Step indicator ───────────────────────────────────────────────────────────

const STEPS = [
  { num: 1, label: "Select Wines" },
  { num: 2, label: "Templates" },
  { num: 3, label: "Review Brief" },
  { num: 4, label: "Generate" },
  { num: 5, label: "Publish" },
];

function StepIndicator({
  current,
  maxReached,
  onNavigate,
}: {
  current: number;
  maxReached: number;
  onNavigate: (step: number) => void;
}) {
  return (
    <nav className="flex items-center gap-1 mb-6 overflow-x-auto pb-1">
      {STEPS.map((s, i) => {
        const isActive = current === s.num;
        const isComplete = s.num < current;
        const canNav = s.num <= maxReached;

        return (
          <div key={s.num} className="flex items-center gap-1">
            <button
              type="button"
              disabled={!canNav}
              onClick={() => canNav && onNavigate(s.num)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap transition-colors ${
                isActive
                  ? "bg-accent text-white font-medium"
                  : isComplete
                  ? "bg-accent/10 text-accent font-medium hover:bg-accent/20"
                  : canNav
                  ? "text-muted hover:text-foreground hover:bg-background"
                  : "text-muted/40 cursor-not-allowed"
              }`}
            >
              <span
                className={`w-4 h-4 rounded-full flex items-center justify-center text-[10px] font-bold ${
                  isActive
                    ? "bg-white/20 text-white"
                    : isComplete
                    ? "bg-accent text-white"
                    : "bg-border text-muted"
                }`}
              >
                {isComplete ? "✓" : s.num}
              </span>
              {s.label}
            </button>
            {i < STEPS.length - 1 && (
              <svg
                className="w-3 h-3 text-muted/30 shrink-0"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            )}
          </div>
        );
      })}
    </nav>
  );
}

// ── PDP Builder inner (needs search params) ──────────────────────────────────

function PDPBuilderInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const stepParam = parseInt(searchParams.get("step") ?? "1", 10);
  const currentStep = Math.max(1, Math.min(5, stepParam));

  const [maxReached, setMaxReached] = useState(currentStep);
  const [selectedTemplateIds, setSelectedTemplateIds] = useState<string[]>([]);

  const feed = useFeed();

  const { batch, overrides, setOverride, readyCount, blockedCount, blockedSummary } =
    useBatchMapping(feed.selected, selectedTemplateIds, feed.contexts);

  const generator = useGenerator(batch, overrides);

  const goToStep = useCallback(
    (step: number) => {
      setMaxReached((prev) => Math.max(prev, step));
      const params = new URLSearchParams(searchParams.toString());
      params.set("step", String(step));
      router.push(`?${params.toString()}`);
    },
    [router, searchParams]
  );

  const toggleTemplate = useCallback((id: string) => {
    setSelectedTemplateIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const handleGenerate = useCallback(async () => {
    goToStep(4);
    await generator.startGeneration();
  }, [goToStep, generator]);

  // Suppress TS unused warning — these are surfaced for debugging/future use
  void [blockedCount, blockedSummary];

  return (
    <div>
      {/* Breadcrumb */}
      <div className="flex items-center gap-2 text-sm text-muted mb-4">
        <Link href="/creative" className="hover:text-foreground transition-colors">
          Creative
        </Link>
        <span>/</span>
        <Link
          href="/creative/ad-builder"
          className="hover:text-foreground transition-colors"
        >
          Ad Builder
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">PDP Builder</span>
      </div>

      <StepIndicator
        current={currentStep}
        maxReached={maxReached}
        onNavigate={goToStep}
      />

      {/* Step 1: Select Wines */}
      {currentStep === 1 && (
        <WineSelector
          filtered={feed.filtered}
          loading={feed.loading}
          error={feed.error}
          selected={feed.selected}
          onToggle={feed.toggleSelect}
          onSelectAll={feed.selectAll}
          onClearSelection={feed.clearSelection}
          channelFilter={feed.channelFilter}
          classificationFilter={feed.classificationFilter}
          inStockOnly={feed.inStockOnly}
          search={feed.search}
          onChannelFilter={feed.setChannelFilter}
          onClassificationFilter={feed.setClassificationFilter}
          onInStockOnly={feed.setInStockOnly}
          onSearch={feed.setSearch}
          onNext={() => goToStep(2)}
        />
      )}

      {/* Step 2: Select Templates */}
      {currentStep === 2 && (
        <TemplateSelector
          selectedWineCount={feed.selected.length}
          selectedTemplateIds={selectedTemplateIds}
          onToggle={toggleTemplate}
          onBack={() => goToStep(1)}
          onNext={() => goToStep(3)}
        />
      )}

      {/* Step 3: Review Brief */}
      {currentStep === 3 && batch && (
        <ReviewBrief
          batch={batch}
          overrides={overrides}
          onOverride={setOverride}
          onBack={() => goToStep(2)}
          onGenerate={handleGenerate}
        />
      )}

      {currentStep === 3 && !batch && (
        <div className="text-center py-16 text-muted text-sm">
          No wines or templates selected. Go back to select them.
        </div>
      )}

      {/* Step 4: Generate & Review */}
      {currentStep === 4 && (
        <GenerationQueue
          ads={generator.ads}
          isGenerating={generator.isGenerating}
          progress={generator.progress}
          onStartGeneration={generator.startGeneration}
          onRegenerateCopy={generator.regenerateCopy}
          onRegenerateImage={generator.regenerateImage}
          onUpdateField={generator.updateField}
          onToggleSelected={generator.toggleSelected}
          onBack={() => goToStep(3)}
          onNext={() => goToStep(5)}
        />
      )}

      {/* Step 5: Publish */}
      {currentStep === 5 && (
        <PublishPanel ads={generator.ads} onBack={() => goToStep(4)} />
      )}

      {/* readyCount indicator at bottom when on review step */}
      {currentStep === 3 && batch && (
        <div className="mt-4 text-[12px] text-muted">
          {readyCount} of {batch.total} combinations ready
        </div>
      )}
    </div>
  );
}

// ── Page export (Suspense boundary for useSearchParams) ──────────────────────

export default function PDPBuilderPage() {
  return (
    <Suspense
      fallback={
        <div className="flex items-center justify-center py-24 text-muted text-sm">
          Loading…
        </div>
      }
    >
      <PDPBuilderInner />
    </Suspense>
  );
}
