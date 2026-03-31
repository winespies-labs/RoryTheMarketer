"use client";

export type CardStatus = "pending" | "applied" | "dismissed";

interface CritiqueCardProps {
  id: string;
  line: string;
  issue: string;
  fix: string;
  severity: "high" | "medium" | "low";
  status: CardStatus;
  onApply: () => void;
  onDismiss: () => void;
  onClick: () => void;
}

const SEVERITY_COLORS = {
  high: "bg-red-100 text-red-700 border-red-200",
  medium: "bg-amber-100 text-amber-700 border-amber-200",
  low: "bg-blue-100 text-blue-700 border-blue-200",
};

export default function CritiqueCard({
  line,
  issue,
  fix,
  severity,
  status,
  onApply,
  onDismiss,
  onClick,
}: CritiqueCardProps) {
  if (status === "dismissed") {
    return (
      <div className="px-3 py-2 rounded-lg border border-border/50 text-xs text-muted bg-surface/50 cursor-pointer hover:bg-surface" onClick={onClick}>
        <span className="line-through">{issue.slice(0, 80)}{issue.length > 80 ? "..." : ""}</span>
        <span className="ml-2 text-[10px]">Dismissed</span>
      </div>
    );
  }

  const isApplied = status === "applied";

  return (
    <div
      className={`rounded-xl border p-4 space-y-3 transition-all cursor-pointer hover:border-accent/50 ${
        isApplied ? "border-green-200 bg-green-50/30 opacity-70" : "border-border bg-surface"
      }`}
      onClick={onClick}
    >
      {/* Header */}
      <div className="flex items-center gap-2">
        <span className={`text-[10px] font-bold uppercase px-1.5 py-0.5 rounded border ${SEVERITY_COLORS[severity]}`}>
          {severity}
        </span>
        {isApplied && (
          <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-green-100 text-green-700 border border-green-200">
            Applied
          </span>
        )}
      </div>

      {/* Flagged text */}
      <blockquote className="text-sm border-l-2 border-muted/30 pl-3 text-muted italic leading-relaxed">
        &ldquo;{line}&rdquo;
      </blockquote>

      {/* Issue */}
      <p className="text-sm text-foreground">{issue}</p>

      {/* Suggested fix */}
      <div className="rounded-lg bg-accent/5 border border-accent/10 px-3 py-2">
        <p className="text-[10px] font-medium text-accent mb-1 uppercase tracking-wider">Suggested fix</p>
        <p className="text-sm text-foreground">{fix}</p>
      </div>

      {/* Actions */}
      {!isApplied && (
        <div className="flex gap-2">
          <button
            onClick={(e) => { e.stopPropagation(); onApply(); }}
            className="px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
          >
            Apply
          </button>
          <button
            onClick={(e) => { e.stopPropagation(); onDismiss(); }}
            className="px-3 py-1.5 text-xs border border-border rounded-lg text-muted hover:border-accent transition-colors"
          >
            Dismiss
          </button>
        </div>
      )}
    </div>
  );
}
