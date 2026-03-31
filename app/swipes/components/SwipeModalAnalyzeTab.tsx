"use client";

import { useEffect, useState, useRef } from "react";
import type { UnifiedSwipe } from "@/lib/unified-swipe";

interface Analysis {
  technique: string;
  whyItWorks: string;
  mechanism: string;
  drillPrompt: string;
}

export default function SwipeModalAnalyzeTab({
  swipe,
}: {
  swipe: UnifiedSwipe;
}) {
  const [analysis, setAnalysis] = useState<Analysis | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const hasRun = useRef(false);

  // If swipe already has analysis data, show it immediately
  const hasExisting = !!(swipe.whyItWorks || swipe.mechanism);

  useEffect(() => {
    if (hasRun.current) return;
    hasRun.current = true;

    if (hasExisting) {
      setAnalysis({
        technique: swipe.category || "Unknown",
        whyItWorks: swipe.whyItWorks || "",
        mechanism: swipe.mechanism || "",
        drillPrompt: swipe.drillPrompt || "",
      });
      return;
    }

    // Auto-run analysis
    setLoading(true);
    fetch("/api/swipe-analysis/analyze-single", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: swipe.content }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.analysis) {
          setAnalysis(data.analysis);
        } else {
          setError(data.error || "Analysis failed");
        }
      })
      .catch((err) => setError(err.message || "Network error"))
      .finally(() => setLoading(false));
  }, [swipe, hasExisting]);

  const reAnalyze = () => {
    setLoading(true);
    setError(null);
    fetch("/api/swipe-analysis/analyze-single", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ content: swipe.content }),
    })
      .then((r) => r.json())
      .then((data) => {
        if (data.ok && data.analysis) {
          setAnalysis(data.analysis);
        } else {
          setError(data.error || "Analysis failed");
        }
      })
      .catch((err) => setError(err.message || "Network error"))
      .finally(() => setLoading(false));
  };

  if (loading) {
    return (
      <div className="py-12 text-center">
        <div className="w-6 h-6 border-2 border-accent border-t-transparent rounded-full animate-spin mx-auto mb-3" />
        <p className="text-sm text-muted">Analyzing this swipe...</p>
        <p className="text-xs text-muted/60 mt-1">Takes a few seconds</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-danger mb-3">{error}</p>
        <button
          onClick={reAnalyze}
          className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:opacity-90"
        >
          Retry Analysis
        </button>
      </div>
    );
  }

  if (!analysis) return null;

  return (
    <div className="space-y-5">
      {/* Technique */}
      <div>
        <div className="text-[11px] tracking-widest uppercase text-accent mb-2">
          Technique
        </div>
        <p className="text-sm font-medium">{analysis.technique}</p>
      </div>

      {/* Why it works */}
      <div>
        <div className="text-[11px] tracking-widest uppercase text-accent mb-2">
          Why It Works
        </div>
        <p className="text-sm leading-relaxed text-muted">
          {analysis.whyItWorks}
        </p>
      </div>

      {/* Mechanism */}
      {analysis.mechanism && (
        <div className="bg-background rounded-lg p-3 flex gap-2 text-xs text-muted">
          <span className="text-accent font-medium shrink-0">Mechanism:</span>
          <span>{analysis.mechanism}</span>
        </div>
      )}

      {/* Drill prompt */}
      {analysis.drillPrompt && (
        <div>
          <div className="text-[11px] tracking-widest uppercase text-accent mb-2">
            Drill Prompt
          </div>
          <p className="text-sm leading-relaxed text-muted">
            {analysis.drillPrompt}
          </p>
        </div>
      )}

      {/* Re-analyze button for items with existing data */}
      {hasExisting && (
        <button
          onClick={reAnalyze}
          className="text-xs text-accent hover:underline"
        >
          Re-analyze with AI
        </button>
      )}
    </div>
  );
}
