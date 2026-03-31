"use client";

interface RubricBarProps {
  element: string;
  score: number;
  note: string;
}

export default function RubricBar({ element, score, note }: RubricBarProps) {
  const pct = (score / 5) * 100;
  const color =
    score <= 2 ? "bg-red-500" : score <= 3 ? "bg-amber-500" : "bg-green-500";

  return (
    <div className="space-y-1">
      <div className="flex items-center justify-between gap-2">
        <span className="text-xs font-medium truncate">{element}</span>
        <span className="text-xs text-muted shrink-0">{score}/5</span>
      </div>
      <div className="h-1.5 bg-border rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      {note && <p className="text-[11px] text-muted leading-snug">{note}</p>}
    </div>
  );
}
