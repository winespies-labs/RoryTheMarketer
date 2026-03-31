"use client";

import ScoreRing from "./ScoreRing";
import RubricBar from "./RubricBar";
import CritiqueCard, { type CardStatus } from "./CritiqueCard";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface RubricScore {
  element: string;
  score: number;
  note: string;
}

interface CritiqueItem {
  id: string;
  line: string;
  issue: string;
  fix: string;
  severity: "high" | "medium" | "low";
}

export interface CritiqueData {
  rubricScores: RubricScore[];
  totalScore: number;
  overallScore: number;
  items: CritiqueItem[];
  fkEstimate: number;
  wordCount: number;
  energyLevel: number;
  biggestWeakness: string;
  fallback?: boolean;
  rawOutput?: string;
}

interface ReviewPanelProps {
  critiqueData: CritiqueData | null;
  critiqueLoading: boolean;
  itemStatuses: Record<string, CardStatus>;
  onRunReview: () => void;
  onApplyFix: (line: string, fix: string, itemId: string) => void;
  onDismissItem: (itemId: string) => void;
  onClickItem: (itemId: string, line: string) => void;
}

export default function ReviewPanel({
  critiqueData,
  critiqueLoading,
  itemStatuses,
  onRunReview,
  onApplyFix,
  onDismissItem,
  onClickItem,
}: ReviewPanelProps) {
  // Fallback: show raw markdown if structured parse failed
  if (critiqueData?.fallback) {
    return (
      <div className="space-y-4">
        <div className="border border-amber-200 rounded-lg bg-amber-50 p-3 text-sm text-amber-700">
          Structured review unavailable. Showing raw output.
        </div>
        <div className="border border-border rounded-xl bg-surface p-4 overflow-auto">
          <div className="prose prose-sm max-w-none">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{critiqueData.rawOutput || ""}</ReactMarkdown>
          </div>
        </div>
        <button
          onClick={onRunReview}
          disabled={critiqueLoading}
          className="w-full px-4 py-2.5 text-sm font-medium border border-border rounded-lg hover:border-accent hover:text-accent disabled:opacity-40 transition-colors"
        >
          Re-run Review
        </button>
      </div>
    );
  }

  if (!critiqueData && !critiqueLoading) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted">
          Run a review to get scored rubric feedback and actionable suggestions.
        </p>
        <button
          onClick={onRunReview}
          className="w-full px-4 py-2.5 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
        >
          Run Review
        </button>
      </div>
    );
  }

  if (critiqueLoading && !critiqueData) {
    return (
      <div className="border border-border rounded-xl bg-surface p-8 flex items-center justify-center">
        <div className="flex items-center gap-2 text-sm text-muted">
          <div className="w-4 h-4 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          Running review...
        </div>
      </div>
    );
  }

  if (!critiqueData) return null;

  const resolvedCount = critiqueData.items.filter(
    (item) => itemStatuses[item.id] === "applied" || itemStatuses[item.id] === "dismissed"
  ).length;
  const totalItems = critiqueData.items.length;

  return (
    <div className="space-y-5">
      {/* Score + rubric */}
      <div className="flex items-start gap-5">
        <ScoreRing score={critiqueData.overallScore} size={100} />
        <div className="flex-1 space-y-2">
          {critiqueData.rubricScores.map((r) => (
            <RubricBar key={r.element} element={r.element} score={r.score} note={r.note} />
          ))}
        </div>
      </div>

      {/* Stats */}
      <div className="flex gap-3 text-xs text-muted">
        <span>FK ~{critiqueData.fkEstimate}</span>
        <span>&middot;</span>
        <span>{critiqueData.wordCount} words</span>
        <span>&middot;</span>
        <span>Energy {critiqueData.energyLevel}/10</span>
      </div>

      {critiqueData.biggestWeakness && (
        <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-800">
          <span className="font-medium">Biggest weakness:</span> {critiqueData.biggestWeakness}
        </div>
      )}

      {/* Suggestions header */}
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-semibold">
          {totalItems} Suggestion{totalItems !== 1 ? "s" : ""}
        </h3>
        <span className="text-xs text-muted">
          {resolvedCount} of {totalItems} resolved
        </span>
      </div>

      {/* Suggestion cards */}
      <div className="space-y-3 max-h-[50vh] overflow-y-auto pr-1">
        {critiqueData.items.map((item) => (
          <CritiqueCard
            key={item.id}
            id={item.id}
            line={item.line}
            issue={item.issue}
            fix={item.fix}
            severity={item.severity}
            status={itemStatuses[item.id] || "pending"}
            onApply={() => onApplyFix(item.line, item.fix, item.id)}
            onDismiss={() => onDismissItem(item.id)}
            onClick={() => onClickItem(item.id, item.line)}
          />
        ))}
      </div>

      {/* Re-run button */}
      <button
        onClick={onRunReview}
        disabled={critiqueLoading}
        className="w-full px-4 py-2.5 text-sm font-medium border border-border rounded-lg hover:border-accent hover:text-accent disabled:opacity-40 transition-colors"
      >
        {critiqueLoading ? "Running..." : "Re-run Review"}
      </button>
    </div>
  );
}
