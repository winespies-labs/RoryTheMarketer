"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { FilledBrief, FilledSlot } from "@/lib/assembler";

interface BriefReviewStepProps {
  briefs: FilledBrief[];
  onApprove: (briefs: FilledBrief[]) => void;
  onBack: () => void;
  generating: boolean;
}

function SlotEditor({
  slot,
  onChange,
}: {
  slot: FilledSlot;
  onChange: (value: string) => void;
}) {
  const isLong = slot.value.length > 60;
  return (
    <div className="mb-3">
      <div className="flex items-center gap-2 mb-1">
        <label className="text-sm font-medium text-foreground capitalize">
          {slot.key.replace(/_/g, " ")}
        </label>
        <span className="text-[10px] px-1.5 py-0.5 rounded bg-surface border border-border text-muted">
          {slot.source}
        </span>
        {slot.truncated && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 border border-amber-200">
            truncated
          </span>
        )}
        {slot.usedFallback && (
          <span className="text-[10px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 border border-blue-200">
            fallback
          </span>
        )}
      </div>
      {isLong ? (
        <textarea
          className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground resize-none focus:ring-1 focus:ring-accent focus:border-accent"
          rows={3}
          value={slot.value}
          onChange={(e) => onChange(e.target.value)}
          readOnly={!slot.editable}
        />
      ) : (
        <input
          type="text"
          className="w-full px-3 py-2 text-sm bg-background border border-border rounded-lg text-foreground focus:ring-1 focus:ring-accent focus:border-accent"
          value={slot.value}
          onChange={(e) => onChange(e.target.value)}
          readOnly={!slot.editable}
        />
      )}
      {slot.maxChars && (
        <div className={`text-[11px] mt-0.5 ${slot.value.length > slot.maxChars ? "text-red-500 font-medium" : slot.value.length >= slot.maxChars * 0.9 ? "text-amber-600" : "text-muted"}`}>
          {slot.value.length}/{slot.maxChars}
        </div>
      )}
    </div>
  );
}

function PricePillPreview({
  pricePill,
}: {
  pricePill: NonNullable<FilledBrief["pricePill"]>;
}) {
  return (
    <div className="flex gap-0 rounded-lg overflow-hidden mb-3">
      <div className="flex-1 bg-white text-gray-800 text-center py-2 px-3">
        <div className="text-[10px] uppercase text-gray-500 font-medium">
          elsewhere
        </div>
        <div className="text-lg font-bold line-through decoration-red-500">
          {pricePill.retail}
        </div>
      </div>
      <div className="flex-1 bg-red-600 text-white text-center py-2 px-3">
        <div className="text-[10px] uppercase opacity-80 font-medium">
          limited time
        </div>
        <div className="text-lg font-bold">{pricePill.sale}</div>
      </div>
    </div>
  );
}

function LivePreview({
  brief,
}: {
  brief: FilledBrief;
}) {
  const [html, setHtml] = useState<string | null>(null);
  const [dimensions, setDimensions] = useState({ width: 1080, height: 1080 });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const briefRef = useRef(brief);
  briefRef.current = brief;

  const fetchPreview = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const currentBrief = briefRef.current;
      const res = await fetch("/api/ad-builder/preview-html", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ templateId: currentBrief.templateId, brief: currentBrief }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Preview failed");
      setHtml(data.html);
      setDimensions({ width: data.width || 1080, height: data.height || 1080 });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Preview failed");
    } finally {
      setLoading(false);
    }
  }, []);

  // Auto-fetch on mount
  useEffect(() => {
    fetchPreview();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Debounced re-fetch when brief changes
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      fetchPreview();
    }, 500);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
    // Re-run when slots change
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brief.slots]);

  const previewWidth = 500;
  const scale = previewWidth / dimensions.width;

  return (
    <div className="h-full flex flex-col">
      <div className="flex items-center justify-between mb-2">
        <span className="text-xs font-medium text-muted uppercase tracking-wider">
          Live Preview
        </span>
        {loading && (
          <span className="flex items-center gap-1.5 text-xs text-muted">
            <svg className="animate-spin h-3 w-3" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            Updating...
          </span>
        )}
      </div>
      {error && (
        <p className="text-xs text-red-500 mb-2">{error}</p>
      )}
      {html ? (
        <div
          className="border border-border rounded-lg overflow-hidden bg-white"
          style={{ width: previewWidth, height: dimensions.height * scale }}
        >
          <iframe
            srcDoc={html}
            sandbox="allow-same-origin"
            style={{
              width: dimensions.width,
              height: dimensions.height,
              transform: `scale(${scale})`,
              transformOrigin: "top left",
              border: "none",
              display: "block",
            }}
            title="Template preview"
          />
        </div>
      ) : !loading ? (
        <div className="flex-1 flex items-center justify-center border border-border rounded-lg bg-background text-sm text-muted min-h-[300px]">
          No preview available
        </div>
      ) : (
        <div className="flex-1 flex items-center justify-center border border-border rounded-lg bg-background min-h-[300px]">
          <svg className="animate-spin h-6 w-6 text-accent" viewBox="0 0 24 24">
            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
          </svg>
        </div>
      )}
    </div>
  );
}

function BriefCard({
  brief,
  index,
  onChange,
}: {
  brief: FilledBrief;
  index: number;
  onChange: (updated: FilledBrief) => void;
}) {
  const updateSlot = (slotKey: string, value: string) => {
    const updatedSlots = brief.slots.map((s) =>
      s.key === slotKey ? { ...s, value, truncated: false } : s,
    );
    onChange({ ...brief, slots: updatedSlots });
  };

  return (
    <div className="border border-border rounded-xl bg-surface p-5">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-sm font-semibold text-foreground">
          Wine #{index + 1} &middot;{" "}
          <span className="text-muted font-normal">{brief.productId}</span>
        </h3>
        <span className="text-xs px-2 py-1 rounded-full bg-accent/10 text-accent font-medium">
          {brief.templateId}
        </span>
      </div>

      <div className="flex gap-6">
        {/* Left column: Slot editors */}
        <div className="w-[45%] shrink-0">
          {brief.slots.map((slot) => (
            <SlotEditor
              key={slot.key}
              slot={slot}
              onChange={(val) => updateSlot(slot.key, val)}
            />
          ))}

          {/* Price pill preview */}
          {brief.pricePill && <PricePillPreview pricePill={brief.pricePill} />}

          {/* Score badge */}
          {brief.scoreBadge && (
            <div className="flex items-center gap-2 mb-3 text-sm">
              <span className="font-bold text-lg text-foreground">
                {brief.scoreBadge.score} points
              </span>
              <span className="text-muted">
                {brief.scoreBadge.source}
              </span>
            </div>
          )}

          {/* Promo code */}
          {brief.promoCode && (
            <div className="text-sm text-muted mb-2">
              Promo: <span className="font-bold text-foreground">{brief.promoCode}</span>
            </div>
          )}

          {/* CTA preview */}
          <div className="mt-3 px-4 py-2.5 bg-foreground text-background rounded-lg text-center text-sm font-bold uppercase tracking-wide">
            {brief.ctaText}
          </div>

          {/* Badges */}
          <div className="flex gap-2 mt-3">
            {brief.showLogo && (
              <span className="text-[10px] px-2 py-1 rounded border border-border text-muted">
                Logo
              </span>
            )}
            {brief.showTrustpilot && (
              <span className="text-[10px] px-2 py-1 rounded border border-border text-muted">
                Trustpilot
              </span>
            )}
          </div>
        </div>

        {/* Right column: Live HTML preview */}
        <div className="flex-1 min-w-0">
          {brief.templateId && <LivePreview brief={brief} />}
        </div>
      </div>
    </div>
  );
}

export default function BriefReviewStep({
  briefs: initialBriefs,
  onApprove,
  onBack,
  generating,
}: BriefReviewStepProps) {
  const [briefs, setBriefs] = useState(initialBriefs);

  const updateBrief = (index: number, updated: FilledBrief) => {
    setBriefs((prev) => prev.map((b, i) => (i === index ? updated : b)));
  };

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <div>
          <h2 className="text-lg font-semibold text-foreground">
            Review Ad Brief{briefs.length > 1 ? "s" : ""}
          </h2>
          <p className="text-sm text-muted mt-0.5">
            Review and edit slot values — the preview updates automatically.
          </p>
        </div>
      </div>

      <div className="grid gap-4 mb-6">
        {briefs.map((brief, i) => (
          <BriefCard
            key={`${brief.templateId}-${brief.productId}-${i}`}
            brief={brief}
            index={i}
            onChange={(updated) => updateBrief(i, updated)}
          />
        ))}
      </div>

      <div className="flex gap-3">
        <button
          type="button"
          onClick={onBack}
          disabled={generating}
          className="px-5 py-2.5 text-sm font-medium rounded-lg border border-border text-foreground hover:bg-surface transition-colors disabled:opacity-50"
        >
          Back
        </button>
        <button
          type="button"
          onClick={() => onApprove(briefs)}
          disabled={generating}
          className="flex-1 px-5 py-2.5 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors disabled:opacity-50"
        >
          {generating ? (
            <span className="flex items-center justify-center gap-2">
              <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              Generating...
            </span>
          ) : (
            `Approve & Generate ${briefs.length > 1 ? `(${briefs.length} ads)` : ""}`
          )}
        </button>
      </div>
    </div>
  );
}
