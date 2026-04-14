// app/creative/ad-builder/studio/components/DownloadPublishPanel.tsx
"use client";

import { useState, useEffect } from "react";
import type { GeneratedImage } from "./GeneratePanel";

interface Campaign {
  id: string;
  name: string;
  status: string;
}

interface AdSet {
  id: string;
  name: string;
  status: string;
}

interface PublishResult {
  imageIndex: number;
  success: boolean;
  adId?: string;
  error?: string;
}

export default function DownloadPublishPanel({
  images,
  brand,
  headline,
  primaryText,
  onBack,
}: {
  images: GeneratedImage[];
  brand: string;
  headline: string;
  primaryText: string;
  onBack: () => void;
}) {
  const [campaigns, setCampaigns] = useState<Campaign[]>([]);
  const [adSets, setAdSets] = useState<AdSet[]>([]);
  const [selectedCampaign, setSelectedCampaign] = useState("");
  const [selectedAdSet, setSelectedAdSet] = useState("");
  const [loadingCampaigns, setLoadingCampaigns] = useState(false);
  const [loadingAdSets, setLoadingAdSets] = useState(false);
  const [publishing, setPublishing] = useState(false);
  const [publishResults, setPublishResults] = useState<PublishResult[]>([]);
  const [publishError, setPublishError] = useState<string | null>(null);
  const [showPublishPanel, setShowPublishPanel] = useState(false);

  const download = (img: GeneratedImage, index: number) => {
    const ext = img.mimeType.split("/")[1] || "png";
    const a = document.createElement("a");
    a.href = `data:${img.mimeType};base64,${img.base64}`;
    a.download = `studio-ad-${index + 1}.${ext}`;
    a.click();
  };

  const loadCampaigns = async () => {
    setLoadingCampaigns(true);
    try {
      const res = await fetch(`/api/pdp/publish?action=campaigns&brand=${brand}`);
      const data = await res.json() as { campaigns: Campaign[] };
      setCampaigns(data.campaigns ?? []);
    } catch (e) {
      console.error(e);
    }
    setLoadingCampaigns(false);
  };

  const loadAdSets = async (campaignId: string) => {
    if (!campaignId) return;
    setLoadingAdSets(true);
    try {
      const res = await fetch(`/api/pdp/publish?action=adsets&brand=${brand}`);
      const data = await res.json() as { adSets: AdSet[] };
      setAdSets(data.adSets ?? []);
    } catch (e) {
      console.error(e);
    }
    setLoadingAdSets(false);
  };

  useEffect(() => {
    if (showPublishPanel) loadCampaigns();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showPublishPanel]);

  useEffect(() => {
    if (selectedCampaign) loadAdSets(selectedCampaign);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCampaign]);

  const handlePublish = async () => {
    if (!selectedAdSet) return;
    setPublishing(true);
    setPublishError(null);
    setPublishResults([]);

    try {
      const jobs = images.map((img, i) => ({
        jobId: `studio-${i}`,
        imageBase64: img.base64,
        mimeType: img.mimeType,
        wineName: `Studio Ad ${i + 1}`,
        headline,
        primary_text: primaryText,
        description: "",
        saleUrl: "https://winespies.com",
      }));

      const res = await fetch("/api/pdp/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand, adSetId: selectedAdSet, jobs }),
      });
      const data = await res.json() as { results: { jobId: string; success: boolean; adId?: string; error?: string }[] };
      const results: PublishResult[] = (data.results ?? []).map((r, i) => ({
        imageIndex: i,
        success: r.success,
        adId: r.adId,
        error: r.error,
      }));
      setPublishResults(results);
    } catch (e) {
      setPublishError(e instanceof Error ? e.message : "Publish failed");
    }
    setPublishing(false);
  };

  return (
    <div className="flex flex-col gap-5">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-base font-semibold">Download & Publish</h2>
          <p className="text-xs text-muted mt-0.5">{images.length} image{images.length > 1 ? "s" : ""} generated</p>
        </div>
        <button type="button" onClick={onBack} className="text-sm text-muted hover:text-foreground">
          ← Back
        </button>
      </div>

      {/* Images with download buttons */}
      <div className="flex flex-col gap-3">
        {images.map((img, i) => (
          <div key={img.base64.slice(0, 16)} className="flex items-start gap-3 p-3 rounded-xl border border-border bg-surface">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={`data:${img.mimeType};base64,${img.base64}`}
              alt={`Ad ${i + 1}`}
              className="w-20 h-20 rounded-lg object-cover border border-border shrink-0"
            />
            <div className="flex-1 flex flex-col gap-2">
              <p className="text-sm font-medium">Ad {i + 1}</p>
              <button
                type="button"
                onClick={() => download(img, i)}
                className="self-start px-3 py-1.5 text-xs border border-border rounded-lg hover:border-accent transition-colors"
              >
                Download
              </button>
            </div>
          </div>
        ))}
      </div>

      {/* Publish section */}
      {!showPublishPanel ? (
        <button
          type="button"
          onClick={() => setShowPublishPanel(true)}
          className="w-full py-2.5 text-sm border border-border rounded-lg hover:border-accent transition-colors"
        >
          Publish to Meta
        </button>
      ) : (
        <div className="flex flex-col gap-3 border border-border rounded-xl p-4">
          <p className="text-sm font-semibold">Publish to Meta</p>

          {loadingCampaigns ? (
            <p className="text-xs text-muted">Loading campaigns...</p>
          ) : (
            <div>
              <label htmlFor="campaign-select" className="text-xs text-muted block mb-1">Campaign</label>
              <select
                id="campaign-select"
                value={selectedCampaign}
                onChange={(e) => { setSelectedCampaign(e.target.value); setSelectedAdSet(""); }}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-surface focus:outline-none focus:border-accent"
              >
                <option value="">Select campaign...</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>{c.name}</option>
                ))}
              </select>
            </div>
          )}

          {selectedCampaign && (
            loadingAdSets ? (
              <p className="text-xs text-muted">Loading ad sets...</p>
            ) : (
              <div>
                <label htmlFor="adset-select" className="text-xs text-muted block mb-1">Ad Set</label>
                <select
                  id="adset-select"
                  value={selectedAdSet}
                  onChange={(e) => setSelectedAdSet(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-surface focus:outline-none focus:border-accent"
                >
                  <option value="">Select ad set...</option>
                  {adSets.map((a) => (
                    <option key={a.id} value={a.id}>{a.name}</option>
                  ))}
                </select>
              </div>
            )
          )}

          {publishError && <p className="text-xs text-danger">{publishError}</p>}

          {publishResults.length > 0 && (
            <div className="flex flex-col gap-1">
              {publishResults.map((r) => (
                <p key={r.imageIndex} className={`text-xs ${r.success ? "text-success" : "text-danger"}`}>
                  Ad {r.imageIndex + 1}: {r.success ? `Published (${r.adId})` : r.error}
                </p>
              ))}
            </div>
          )}

          <button
            type="button"
            onClick={handlePublish}
            disabled={!selectedAdSet || publishing}
            className="w-full py-2.5 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-40 transition-colors font-medium"
          >
            {publishing ? "Publishing..." : `Publish ${images.length} ad${images.length > 1 ? "s" : ""}`}
          </button>
        </div>
      )}
    </div>
  );
}
