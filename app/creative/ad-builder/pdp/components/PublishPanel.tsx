"use client";

import type { GeneratedAd } from "../hooks/useGenerator";

interface PublishPanelProps {
  ads: GeneratedAd[];
  onBack: () => void;
}

export default function PublishPanel({ ads, onBack }: PublishPanelProps) {
  const selectedAds = ads.filter((a) => a.selected && a.status === "complete");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Publish to Meta</h2>
          <p className="text-sm text-muted mt-0.5">
            Review selected ads and publish to your Meta ad account.
          </p>
        </div>
        <button
          onClick={onBack}
          className="px-3 py-2 text-sm text-muted hover:text-foreground transition-colors"
        >
          ← Back
        </button>
      </div>

      {selectedAds.length === 0 ? (
        <div className="rounded-xl border border-border py-12 text-center text-muted text-sm">
          No ads selected. Go back and select ads to publish.
        </div>
      ) : (
        <>
          <div className="rounded-lg border border-border/50 bg-amber-50 px-4 py-3 text-sm text-amber-800">
            Meta publishing via Pipeboard MCP — coming soon. Export options available in the next update.
          </div>

          <div className="flex flex-col gap-3">
            {selectedAds.map((ad) => (
              <div
                key={ad.mapping_key}
                className="rounded-xl border border-border bg-surface p-4 flex flex-col gap-2"
              >
                <div className="font-medium text-sm text-foreground">
                  {ad.context.display_name}
                </div>
                <div className="text-[12px] text-muted space-y-1">
                  <div>
                    <span className="font-semibold">Headline:</span> {ad.headline}
                  </div>
                  <div>
                    <span className="font-semibold">Primary Text:</span>{" "}
                    {ad.primary_text}
                  </div>
                  <div>
                    <span className="font-semibold">Description:</span>{" "}
                    {ad.description}
                  </div>
                  <div>
                    <span className="font-semibold">URL:</span>{" "}
                    <a
                      href={ad.sale_url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-accent hover:underline"
                    >
                      {ad.sale_url}
                    </a>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="flex justify-end">
            <button
              disabled
              className="px-5 py-2.5 bg-accent text-white text-sm font-medium rounded-lg opacity-40 cursor-not-allowed"
            >
              Publish {selectedAds.length} Ad{selectedAds.length !== 1 ? "s" : ""} →
            </button>
          </div>
        </>
      )}
    </div>
  );
}
