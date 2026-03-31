"use client";

import { useEffect, useState } from "react";
import type { GeneratedAdResult } from "./BatchResults";

type AdSetOption = {
  id: string;
  name: string;
  status: string;
  effective_status: string;
};

type PublishResult = {
  adId: string;
  wineName: string;
  status: "success" | "error";
  metaAdId?: string;
  error?: string;
};

type Props = {
  ads: GeneratedAdResult[];
  onBack: () => void;
  onDone: () => void;
};

export default function PublishPanel({ ads, onBack, onDone }: Props) {
  const [adsets, setAdsets] = useState<AdSetOption[]>([]);
  const [loadingAdsets, setLoadingAdsets] = useState(true);
  const [selectedAdsetId, setSelectedAdsetId] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [progress, setProgress] = useState(0);
  const [results, setResults] = useState<PublishResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/meta-ads/adsets-live?brand=winespies")
      .then((r) => r.json())
      .then((data) => {
        if (data.adsets) {
          setAdsets(data.adsets);
          // Auto-select first active ad set
          const active = data.adsets.find(
            (a: AdSetOption) => a.effective_status === "ACTIVE",
          );
          if (active) setSelectedAdsetId(active.id);
        }
      })
      .catch((err) => setError(err.message))
      .finally(() => setLoadingAdsets(false));
  }, []);

  const doPublish = async () => {
    if (!selectedAdsetId) return;
    setPublishing(true);
    setResults([]);
    setProgress(0);
    setError(null);

    try {
      const res = await fetch("/api/wines/publish-to-meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: "winespies",
          adsetId: selectedAdsetId,
          ads: ads.map((ad) => ({
            id: ad.id,
            wineName: ad.wineName,
            saleId: ad.saleId,
            imageBase64: ad.imageBase64,
            copyVariation: ad.copyVariation,
            destinationUrl: ad.destinationUrl,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Publish failed");
        return;
      }

      setResults(data.results ?? []);
      setProgress(100);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Publish failed");
    } finally {
      setPublishing(false);
    }
  };

  const successCount = results.filter((r) => r.status === "success").length;
  const failCount = results.filter((r) => r.status === "error").length;
  const isDone = results.length > 0;

  return (
    <div className="flex flex-col h-full">
      <div className="flex-1 overflow-y-auto p-6 space-y-6">
        <div>
          <h3 className="text-sm font-semibold mb-1">Publish to Meta</h3>
          <p className="text-xs text-muted">
            {ads.length} ad{ads.length !== 1 ? "s" : ""} ready to publish.
            Each ad will be created as ACTIVE in the selected ad set.
          </p>
        </div>

        {/* Ad set picker */}
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">
            Select Ad Set
          </label>
          {loadingAdsets ? (
            <p className="text-sm text-muted">Loading ad sets from Meta...</p>
          ) : adsets.length === 0 ? (
            <p className="text-sm text-muted">
              No ad sets found. Create one in Meta Ads Manager first.
            </p>
          ) : (
            <select
              value={selectedAdsetId}
              onChange={(e) => setSelectedAdsetId(e.target.value)}
              disabled={publishing || isDone}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-surface"
            >
              <option value="">Choose an ad set...</option>
              {adsets.map((as) => (
                <option key={as.id} value={as.id}>
                  {as.name} ({as.effective_status})
                </option>
              ))}
            </select>
          )}
        </div>

        {/* Ads summary */}
        <div>
          <label className="text-sm font-medium text-foreground mb-2 block">
            Ads to Publish
          </label>
          <div className="border border-border rounded-lg divide-y divide-border">
            {ads.map((ad) => {
              const result = results.find((r) => r.adId === ad.id);
              return (
                <div key={ad.id} className="px-3 py-2 flex items-center justify-between">
                  <div className="min-w-0 flex-1">
                    <div className="text-xs font-medium truncate">{ad.wineName}</div>
                    <div className="text-[10px] text-muted truncate">
                      {ad.copyVariation.headline} — {ad.destinationUrl}
                    </div>
                  </div>
                  {result && (
                    <span
                      className={`text-[10px] font-medium px-2 py-0.5 rounded ml-2 shrink-0 ${
                        result.status === "success"
                          ? "bg-green-100 text-green-800"
                          : "bg-red-100 text-red-800"
                      }`}
                    >
                      {result.status === "success"
                        ? `Ad ${result.metaAdId}`
                        : result.error ?? "Failed"}
                    </span>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {/* Error */}
        {error && (
          <div className="text-sm text-danger bg-danger/10 rounded-lg px-4 py-3">
            {error}
          </div>
        )}

        {/* Results summary */}
        {isDone && (
          <div className="bg-background border border-border rounded-lg p-4">
            <h4 className="text-sm font-semibold mb-1">Publish Complete</h4>
            <p className="text-xs text-muted">
              {successCount} succeeded, {failCount} failed
            </p>
          </div>
        )}
      </div>

      {/* Footer */}
      <div className="border-t border-border p-4 flex justify-between items-center">
        <button
          type="button"
          onClick={onBack}
          disabled={publishing}
          className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-background transition-colors disabled:opacity-50"
        >
          Back
        </button>
        {isDone ? (
          <button
            type="button"
            onClick={onDone}
            className="px-6 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            Done
          </button>
        ) : (
          <button
            type="button"
            disabled={publishing || !selectedAdsetId}
            onClick={doPublish}
            className="px-6 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
          >
            {publishing && (
              <svg
                className="animate-spin h-4 w-4"
                viewBox="0 0 24 24"
                fill="none"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                />
              </svg>
            )}
            {publishing ? "Publishing..." : `Publish ${ads.length} Ads`}
          </button>
        )}
      </div>
    </div>
  );
}
