"use client";

interface ProgressBarProps {
  filled: number;
  total: number;
}

export default function ProgressBar({ filled, total }: ProgressBarProps) {
  const pct = total > 0 ? Math.round((filled / total) * 100) : 0;

  return (
    <div className="px-5 pb-4">
      <div className="flex items-center justify-between text-xs text-muted mb-1.5">
        <span>Training progress</span>
        <span>{pct}%</span>
      </div>
      <div className="h-1.5 bg-border rounded-full overflow-hidden">
        <div
          className="h-full bg-accent rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  );
}
