"use client";

interface PlaceholderPanelProps {
  label: string;
}

export default function PlaceholderPanel({ label }: PlaceholderPanelProps) {
  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">{label}</h2>

      <div className="rounded-xl border-2 border-dashed border-border bg-surface p-10 text-center">
        <div className="text-3xl mb-3 opacity-40">&#128679;</div>
        <p className="text-sm font-medium text-muted mb-1">Coming soon</p>
        <p className="text-xs text-muted max-w-sm mx-auto">
          This section will be available in a future update. It will integrate with Foreplay and the Meta Ad Library for competitive intelligence.
        </p>
      </div>
    </div>
  );
}
