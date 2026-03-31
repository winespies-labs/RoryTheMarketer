"use client";

import type { WineDetails } from "@/lib/ad-builder";

interface WineDetailsFormProps {
  details: WineDetails;
  onChange: (details: WineDetails) => void;
}

export default function WineDetailsForm({
  details,
  onChange,
}: WineDetailsFormProps) {
  const update = (field: keyof WineDetails, value: string) => {
    onChange({ ...details, [field]: value });
  };

  return (
    <div className="space-y-4">
      <div>
        <label className="block text-xs font-medium text-muted mb-1">
          Headline <span className="text-danger">*</span>
        </label>
        <input
          type="text"
          value={details.headline}
          onChange={(e) => update("headline", e.target.value)}
          placeholder='e.g. "2021 Château Margaux"'
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-muted mb-1">
            Score / Points
          </label>
          <input
            type="text"
            value={details.score || ""}
            onChange={(e) => update("score", e.target.value)}
            placeholder='e.g. "95 Points — Wine Spectator"'
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">
            Promo Code
          </label>
          <input
            type="text"
            value={details.promoCode || ""}
            onChange={(e) => update("promoCode", e.target.value)}
            placeholder="e.g. WINE20"
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-muted mb-1">
          Pull Quote
        </label>
        <textarea
          value={details.pullQuote || ""}
          onChange={(e) => update("pullQuote", e.target.value)}
          rows={2}
          placeholder="A short quote from a reviewer or tasting note"
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background resize-y"
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-muted mb-1">
            Retail Price
          </label>
          <input
            type="text"
            value={details.retailPrice || ""}
            onChange={(e) => update("retailPrice", e.target.value)}
            placeholder="e.g. $89"
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">
            Sale Price
          </label>
          <input
            type="text"
            value={details.salePrice || ""}
            onChange={(e) => update("salePrice", e.target.value)}
            placeholder="e.g. $49"
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div>
          <label className="block text-xs font-medium text-muted mb-1">
            CTA Text
          </label>
          <input
            type="text"
            value={details.ctaText || ""}
            onChange={(e) => update("ctaText", e.target.value)}
            placeholder="GET THIS DEAL"
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
          />
        </div>
        <div />
      </div>

      <div>
        <label className="block text-xs font-medium text-muted mb-1">
          Additional Notes
        </label>
        <textarea
          value={details.additionalNotes || ""}
          onChange={(e) => update("additionalNotes", e.target.value)}
          rows={2}
          placeholder="Extra instructions for the image generation model"
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background resize-y"
        />
      </div>
    </div>
  );
}
