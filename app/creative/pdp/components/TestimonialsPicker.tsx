"use client";

import { useState, useEffect, useCallback } from "react";
import type { Review } from "@/lib/reviews";

interface TestimonialsPickerProps {
  onSelect: (quote: string) => void;
  selectedQuote?: string;
}

const USP_BADGE: Record<string, { label: string; className: string }> = {
  "best-price": { label: "Best Price", className: "bg-green-100 text-green-700" },
  "locker": { label: "Locker", className: "bg-blue-100 text-blue-700" },
  "satisfaction-guaranteed": { label: "Satisfaction", className: "bg-purple-100 text-purple-700" },
};

export default function TestimonialsPicker({
  onSelect,
  selectedQuote,
}: TestimonialsPickerProps) {
  const [open, setOpen] = useState(false);
  const [testimonials, setTestimonials] = useState<Review[]>([]);
  const [loading, setLoading] = useState(false);
  const [fetched, setFetched] = useState(false);

  const fetchTestimonials = useCallback(async () => {
    if (fetched) return;
    setLoading(true);
    try {
      const res = await fetch(
        "/api/testimonials?brand=winespies&sort=score&limit=15"
      );
      if (!res.ok) throw new Error("Failed to fetch testimonials");
      const data = await res.json();
      const scored: Review[] = (data.testimonials ?? []).filter(
        (r: Review) => r.extractedQuote != null && r.extractedQuote !== ""
      );
      setTestimonials(scored);
    } catch {
      setTestimonials([]);
    } finally {
      setLoading(false);
      setFetched(true);
    }
  }, [fetched]);

  useEffect(() => {
    if (open && !fetched) {
      fetchTestimonials();
    }
  }, [open, fetched, fetchTestimonials]);

  return (
    <div className="border border-border rounded-xl overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between px-4 py-3 bg-border hover:bg-border/80 transition-colors text-left"
      >
        <div className="flex flex-col gap-0.5">
          <span className="text-sm font-semibold text-foreground">
            Testimonials
          </span>
          {!open && (
            <span className="text-xs text-muted">
              {selectedQuote
                ? "1 customer quote applied to all wines"
                : "Add a customer quote to all wines"}
            </span>
          )}
        </div>
        <svg
          className={`w-4 h-4 text-muted transition-transform shrink-0 ${open ? "rotate-180" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            strokeWidth={2}
            d="M19 9l-7 7-7-7"
          />
        </svg>
      </button>

      {open && (
        <div className="px-4 py-3 flex flex-col gap-2">
          {loading && (
            <p className="text-xs text-muted py-4 text-center">
              Loading testimonials…
            </p>
          )}

          {!loading && testimonials.length === 0 && (
            <p className="text-xs text-muted py-4 text-center">
              No scored testimonials found. Score some reviews first.
            </p>
          )}

          {!loading &&
            testimonials.map((review) => {
              const quote = review.extractedQuote!;
              const isSelected = selectedQuote === quote;
              const uspInfo = review.uspCategory
                ? USP_BADGE[review.uspCategory]
                : null;

              return (
                <button
                  key={review.id}
                  type="button"
                  onClick={() => onSelect(quote)}
                  className={`w-full text-left px-3 py-2.5 rounded-lg border transition-colors ${
                    isSelected
                      ? "border-accent bg-accent/10"
                      : "border-border bg-surface hover:bg-background"
                  }`}
                >
                  <p
                    className={`text-xs leading-snug ${
                      isSelected ? "text-accent font-medium" : "text-foreground"
                    }`}
                  >
                    &ldquo;{quote}&rdquo;
                  </p>
                  <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                    {review.author && (
                      <span className="text-[10px] text-muted">
                        — {review.author}
                      </span>
                    )}
                    {uspInfo && (
                      <span
                        className={`text-[10px] font-medium px-1.5 py-0.5 rounded-full ${uspInfo.className}`}
                      >
                        {uspInfo.label}
                      </span>
                    )}
                    {review.adScore != null && (
                      <span className="text-[10px] font-semibold px-1.5 py-0.5 rounded-full bg-accent/10 text-accent">
                        {review.adScore}
                      </span>
                    )}
                  </div>
                </button>
              );
            })}
        </div>
      )}
    </div>
  );
}
