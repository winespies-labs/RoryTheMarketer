// app/creative/pdp/page.tsx
"use client";

import { useCallback, useState, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import Link from "next/link";

import { useFeed } from "./hooks/useFeed";
import { useStyles } from "./hooks/useStyles";
import { useGenerator, type WineOverrides } from "./hooks/useGenerator";
import { useBatchMapping } from "./hooks/useBatchMapping";
import WineSelector from "./components/WineSelector";
import StyleSelector from "./components/StyleSelector";
import DataReview from "./components/DataReview";
import ResultsGrid from "./components/ResultsGrid";
import PublishPanel from "./components/PublishPanel";

const STEPS = [
  { num: 1, label: "Select Wines" },
  { num: 2, label: "Select Styles" },
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
  onNavigate: (n: number) => void;
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
              <svg className="w-3 h-3 text-muted/30 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
              </svg>
            )}
          </div>
        );
      })}
    </nav>
  );
}

function PDPBuilderInner() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [maxReached, setMaxReached] = useState(1);
  const currentStep = Math.max(1, Math.min(maxReached, parseInt(searchParams.get("step") ?? "1", 10)));
  const [selectedStyleIds, setSelectedStyleIds] = useState<string[]>([]);
  const [overrides, setOverrides] = useState<Record<number, WineOverrides>>({});

  const feed = useFeed();
  const { styles, loading: stylesLoading, error: stylesError, refresh: refreshStyles } = useStyles();
  const generator = useGenerator();
  const selectedStyles = styles.filter((s) => selectedStyleIds.includes(s.id));
  const batch = useBatchMapping(feed.selectedContexts, selectedStyles);

  const goToStep = useCallback(
    (step: number) => {
      setMaxReached((prev) => Math.max(prev, step));
      const params = new URLSearchParams(searchParams.toString());
      params.set("step", String(step));
      router.push(`?${params.toString()}`);
    },
    [router, searchParams]
  );

  const toggleStyle = useCallback((id: string) => {
    setSelectedStyleIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  }, []);

  const setOverride = useCallback(
    (saleId: number, field: keyof WineOverrides, value: string) => {
      setOverrides((prev) => ({
        ...prev,
        [saleId]: { ...prev[saleId], [field]: value },
      }));
    },
    []
  );

  const handleGenerate = useCallback(async () => {
    goToStep(4);
    const selectedStyles = styles.filter((s) => selectedStyleIds.includes(s.id));
    await generator.startBatch(feed.selectedContexts, selectedStyles, overrides);
  }, [goToStep, styles, selectedStyleIds, feed.selectedContexts, overrides, generator]);

  const handleRegenerate = useCallback(
    async (jobId: string) => {
      const job = generator.jobs.find((j) => j.id === jobId);
      if (!job) return;
      const ctx = feed.selectedContexts.find((c) => c.sale_id === job.saleId);
      const style = styles.find((s) => s.id === job.styleId);
      if (!ctx || !style) return;
      await generator.regenerate(jobId, ctx, style, overrides[job.saleId] ?? {});
    },
    [generator, feed.selectedContexts, styles, overrides]
  );

  return (
    <div>
      <div className="flex items-center gap-2 text-sm text-muted mb-4">
        <Link href="/creative" className="hover:text-foreground transition-colors">
          Creative
        </Link>
        <span>/</span>
        <span className="text-foreground font-medium">PDP Ad Builder</span>
      </div>

      <StepIndicator current={currentStep} maxReached={maxReached} onNavigate={goToStep} />

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

      {currentStep === 2 && (
        <StyleSelector
          styles={styles}
          loading={stylesLoading}
          error={stylesError}
          selected={selectedStyleIds}
          onToggle={toggleStyle}
          onBack={() => goToStep(1)}
          onNext={() => goToStep(3)}
          selectedWineCount={feed.selected.length}
          onStylesRefresh={refreshStyles}
        />
      )}

      {currentStep === 3 && batch && (
        <DataReview
          batch={batch}
          overrides={overrides}
          onOverride={setOverride}
          onBack={() => goToStep(2)}
          onGenerate={handleGenerate}
        />
      )}

      {currentStep === 3 && !batch && (
        <div className="text-center py-16 text-muted text-sm">
          Select wines and styles first to review the brief.
        </div>
      )}

      {currentStep === 4 && (
        <ResultsGrid
          jobs={generator.jobs}
          running={generator.running}
          progress={generator.progress}
          onRegenerate={handleRegenerate}
          onBack={() => goToStep(3)}
          onPublish={() => goToStep(5)}
        />
      )}

      {currentStep === 5 && (
        <PublishPanel
          jobs={generator.jobs.filter((j) => j.status === "complete")}
          onBack={() => goToStep(4)}
        />
      )}
    </div>
  );
}

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
