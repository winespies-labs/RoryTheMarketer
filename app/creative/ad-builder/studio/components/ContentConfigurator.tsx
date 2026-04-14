// app/creative/ad-builder/studio/components/ContentConfigurator.tsx
"use client";

import { useState, useEffect } from "react";
import type { StudioStyle } from "../hooks/useStudioStyles";

export interface ContentTokens {
  headline: string;
  primaryText: string;
  ctaText: string;
  reviewerName: string;
  stars: string;
  usp: string;
}

interface Review {
  id: string;
  text: string;
  author: string;
  rating: number;
}

function Field({
  label,
  value,
  onChange,
  multiline = false,
  placeholder = "",
  id,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  multiline?: boolean;
  placeholder?: string;
  id: string;
}) {
  return (
    <div>
      <label htmlFor={id} className="text-xs font-medium text-muted block mb-1">{label}</label>
      {multiline ? (
        <textarea
          id={id}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-surface focus:outline-none focus:border-accent resize-none"
        />
      ) : (
        <input
          id={id}
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-surface focus:outline-none focus:border-accent"
        />
      )}
    </div>
  );
}

export default function ContentConfigurator({
  style,
  brand,
  onComplete,
  onBack,
}: {
  style: StudioStyle;
  brand: string;
  onComplete: (tokens: ContentTokens) => void;
  onBack: () => void;
}) {
  const angle = style.angle ?? "lifestyle";

  const [tokens, setTokens] = useState<ContentTokens>({
    headline: "",
    primaryText: "",
    ctaText: "Shop Now",
    reviewerName: "",
    stars: "",
    usp: "",
  });
  const [generating, setGenerating] = useState(false);
  const [usps, setUsps] = useState<string[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [selectedUsp, setSelectedUsp] = useState("");
  const [selectedReview, setSelectedReview] = useState<Review | null>(null);
  const [copyError, setCopyError] = useState<string | null>(null);

  // Load context data
  useEffect(() => {
    if (angle === "usp") {
      fetch(`/api/studio/usps?brand=${brand}`)
        .then((r) => r.json())
        .then((data: { usps: string }) => {
          const lines = data.usps
            .split("\n")
            .map((l) => l.replace(/^[-*]\s*/, "").trim())
            .filter(Boolean);
          setUsps(lines);
        })
        .catch(console.error);
    }
    if (angle === "testimonial") {
      fetch(`/api/reviews?brand=${brand}&minRating=4&limit=5`)
        .then((r) => r.json())
        .then((data: { page: Review[] }) => setReviews(data.page ?? []))
        .catch(console.error);
    }
  }, [angle, brand]);

  // Auto-generate copy for lifestyle and offer on mount
  useEffect(() => {
    if (angle === "lifestyle" || angle === "offer") {
      generateCopy();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const generateCopy = async (selectedContent?: string) => {
    setGenerating(true);
    setCopyError(null);
    try {
      const res = await fetch("/api/studio/generate-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand,
          angle,
          nanoBanana: style.nanoBanana ?? "",
          selectedContent,
        }),
      });
      if (!res.ok) {
        const d = await res.json() as { error: string };
        throw new Error(d.error);
      }
      const data = await res.json() as { headline: string; primaryText: string; ctaText: string };
      setTokens((prev) => ({
        ...prev,
        headline: data.headline,
        primaryText: data.primaryText,
        ctaText: data.ctaText,
      }));
    } catch (e) {
      setCopyError(e instanceof Error ? e.message : "Copy generation failed");
    }
    setGenerating(false);
  };

  const handleUspSelect = (usp: string) => {
    setSelectedUsp(usp);
    setTokens((prev) => ({ ...prev, usp }));
    generateCopy(usp);
  };

  const handleReviewSelect = (review: Review) => {
    setSelectedReview(review);
    setTokens((prev) => ({
      ...prev,
      primaryText: review.text,
      reviewerName: review.author,
      stars: "★".repeat(review.rating),
    }));
    generateCopy(review.text);
  };

  const update = (key: keyof ContentTokens) => (val: string) =>
    setTokens((prev) => ({ ...prev, [key]: val }));

  const canProceed = tokens.headline.trim().length > 0 && tokens.ctaText.trim().length > 0;

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Configure Content</h2>
          <p className="text-xs text-muted mt-0.5">
            Style: <span className="font-medium text-foreground">{style.label}</span>
            {style.angle && (
              <span className="ml-2 capitalize">· {style.angle}</span>
            )}
          </p>
        </div>
        <button
          type="button"
          onClick={onBack}
          className="text-sm text-muted hover:text-foreground"
        >
          ← Back
        </button>
      </div>

      {/* USP angle: USP picker */}
      {angle === "usp" && usps.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted mb-2">Select a USP</p>
          <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto pr-1">
            {usps.map((usp, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleUspSelect(usp)}
                className={`w-full text-left px-3 py-2 text-sm rounded-lg border transition-colors ${
                  selectedUsp === usp
                    ? "border-accent bg-accent/5"
                    : "border-border bg-surface hover:border-accent/40"
                }`}
              >
                {usp}
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Testimonial angle: review picker */}
      {angle === "testimonial" && reviews.length > 0 && (
        <div>
          <p className="text-xs font-medium text-muted mb-2">Select a review</p>
          <div className="flex flex-col gap-2 max-h-56 overflow-y-auto pr-1">
            {reviews.map((r) => (
              <button
                key={r.id}
                type="button"
                onClick={() => handleReviewSelect(r)}
                className={`w-full text-left px-3 py-2.5 text-sm rounded-lg border transition-colors ${
                  selectedReview?.id === r.id
                    ? "border-accent bg-accent/5"
                    : "border-border bg-surface hover:border-accent/40"
                }`}
              >
                <div className="flex items-center gap-2 mb-1">
                  <span className="text-amber-500">{"★".repeat(r.rating)}</span>
                  <span className="text-xs text-muted">{r.author}</span>
                </div>
                <p className="text-xs leading-relaxed line-clamp-3">{r.text}</p>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Testimonial / empty fallback */}
      {angle === "testimonial" && reviews.length === 0 && (
        <p className="text-xs text-muted">No high-rated reviews available. Enter copy manually below.</p>
      )}

      {/* Generating indicator */}
      {generating && (
        <div className="flex items-center gap-2 text-sm text-muted">
          <div className="w-3.5 h-3.5 border-2 border-accent border-t-transparent rounded-full animate-spin" />
          Drafting copy...
        </div>
      )}
      {copyError && <p className="text-xs text-danger">{copyError}</p>}

      {/* Generate copy button (USP after selection, or re-generate anytime) */}
      {(angle === "lifestyle" || angle === "offer" || (angle === "usp" && !selectedUsp) || (angle === "testimonial" && !selectedReview)) && (
        <button
          type="button"
          onClick={() => generateCopy()}
          disabled={generating}
          className="self-start px-4 py-2 text-sm border border-border rounded-lg hover:border-accent transition-colors disabled:opacity-50"
        >
          {generating ? "Generating..." : "Draft with Claude"}
        </button>
      )}

      {/* Editable fields */}
      <div className="flex flex-col gap-3 border-t border-border pt-4">
        <p className="text-xs font-medium text-muted uppercase tracking-wide">Review & edit copy</p>

        <Field id="field-headline" label="Headline" value={tokens.headline} onChange={update("headline")} placeholder="Main headline..." />
        <Field id="field-primary-text" label="Body copy" value={tokens.primaryText} onChange={update("primaryText")} multiline placeholder="Supporting copy or testimonial quote..." />
        <Field id="field-cta" label="CTA" value={tokens.ctaText} onChange={update("ctaText")} placeholder="Shop Now" />

        {angle === "testimonial" && (
          <>
            <Field id="field-reviewer" label="Reviewer name" value={tokens.reviewerName} onChange={update("reviewerName")} placeholder="Jane D." />
            <Field id="field-stars" label="Stars (e.g. ★★★★★)" value={tokens.stars} onChange={update("stars")} placeholder="★★★★★" />
          </>
        )}

        {angle === "usp" && (
          <Field id="field-usp" label="USP statement" value={tokens.usp} onChange={update("usp")} placeholder="Direct access to wines most people never find..." />
        )}
      </div>

      <button
        type="button"
        onClick={() => onComplete(tokens)}
        disabled={!canProceed}
        className="w-full py-2.5 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-40 transition-colors font-medium"
      >
        Continue to Generate
      </button>
    </div>
  );
}
