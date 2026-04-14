"use client";

import { useState } from "react";
import ReviewsPanel from "./ReviewsPanel";
import AdScoresPanel from "./AdScoresPanel";

type Tab = "reviews" | "scores";

const TABS: { key: Tab; label: string }[] = [
  { key: "reviews", label: "Reviews" },
  { key: "scores", label: "Ad Scores" },
];

export default function ReviewsPage() {
  const [tab, setTab] = useState<Tab>("reviews");

  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold text-foreground mb-1">
        Reviews
      </h1>
      <p className="text-sm text-muted mb-5">
        Import reviews from Slack or upload CSV/JSON. Score and categorize by USP for use in ads.
      </p>

      <div className="flex gap-1 mb-6 border-b border-border">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`px-4 py-2 text-sm font-medium transition-colors border-b-2 -mb-px ${
              tab === t.key
                ? "border-accent text-accent"
                : "border-transparent text-muted hover:text-foreground"
            }`}
          >
            {t.label}
          </button>
        ))}
      </div>

      {tab === "reviews" ? <ReviewsPanel /> : <AdScoresPanel />}
    </div>
  );
}
