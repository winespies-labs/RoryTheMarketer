"use client";

import { useCallback, useEffect, useState } from "react";

const BRAND_ID = "winespies";

interface ForeplayAd {
  id: string;
  domain?: string;
  headline?: string;
  body?: string;
  imageUrl?: string;
  videoUrl?: string;
  pageName?: string;
  createdAt?: string;
}

interface AdsLibraryAd {
  id: string;
  ad_snapshot_url?: string;
  ad_creative_bodies?: string[];
  page_name?: string;
  ad_delivery_start_time?: string;
}

export default function CompetitorAdsPanel() {
  const [sourceTab, setSourceTab] = useState<"foreplay" | "ads_library">("foreplay");
  const [foreplayData, setForeplayData] = useState<{ syncedAt: string; ads: ForeplayAd[] } | null>(null);
  const [adsLibraryData, setAdsLibraryData] = useState<{
    searchedAt: string;
    query: string;
    results: AdsLibraryAd[];
  } | null>(null);
  const [foreplaySyncBusy, setForeplaySyncBusy] = useState(false);
  const [searchBusy, setSearchBusy] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchCountries, setSearchCountries] = useState("US");
  const [analyzingId, setAnalyzingId] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<string | null>(null);

  const fetchForeplay = useCallback(() => {
    fetch(`/api/foreplay/ads?brand=${BRAND_ID}`)
      .then((r) => r.json())
      .then(setForeplayData)
      .catch(() => setForeplayData(null));
  }, []);

  const fetchAdsLibrary = useCallback(() => {
    fetch(`/api/ads-library/results?brand=${BRAND_ID}`)
      .then((r) => r.json())
      .then(setAdsLibraryData)
      .catch(() => setAdsLibraryData(null));
  }, []);

  useEffect(() => {
    if (sourceTab === "foreplay") fetchForeplay();
    else fetchAdsLibrary();
  }, [sourceTab, fetchForeplay, fetchAdsLibrary]);

  const handleForeplaySync = async () => {
    setForeplaySyncBusy(true);
    try {
      const res = await fetch("/api/foreplay/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand: BRAND_ID }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Sync failed");
      fetchForeplay();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setForeplaySyncBusy(false);
    }
  };

  const handleAdsLibrarySearch = async () => {
    if (!searchQuery.trim()) return;
    setSearchBusy(true);
    try {
      const params = new URLSearchParams({ brand: BRAND_ID, q: searchQuery.trim() });
      if (searchCountries.trim()) params.set("countries", searchCountries.trim());
      const res = await fetch(`/api/ads-library/search?${params}`);
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Search failed");
      fetchAdsLibrary();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Search failed");
    } finally {
      setSearchBusy(false);
    }
  };

  const handleAnalyze = async (source: "foreplay" | "ads_library", id: string) => {
    setAnalyzingId(id);
    setAnalysisResult(null);
    try {
      const res = await fetch("/api/analyze-competitor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand: BRAND_ID, source, id }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error ?? "Analysis failed");
      setAnalysisResult(data.analysis ?? "");
    } catch (e) {
      setAnalysisResult(e instanceof Error ? e.message : "Analysis failed");
    } finally {
      setAnalyzingId(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex gap-2 border-b border-border pb-2">
        <button
          type="button"
          onClick={() => setSourceTab("foreplay")}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            sourceTab === "foreplay"
              ? "bg-accent text-white"
              : "bg-surface border border-border text-muted hover:text-foreground"
          }`}
        >
          Foreplay
        </button>
        <button
          type="button"
          onClick={() => setSourceTab("ads_library")}
          className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
            sourceTab === "ads_library"
              ? "bg-accent text-white"
              : "bg-surface border border-border text-muted hover:text-foreground"
          }`}
        >
          Meta Ad Library
        </button>
      </div>

      {sourceTab === "foreplay" && (
        <>
          <div className="flex items-center gap-3 flex-wrap">
            <p className="text-sm text-muted">
              {foreplayData?.syncedAt
                ? `Last synced: ${new Date(foreplayData.syncedAt).toLocaleString()}`
                : "Not synced yet."}
            </p>
            <button
              type="button"
              onClick={handleForeplaySync}
              disabled={foreplaySyncBusy}
              className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {foreplaySyncBusy ? "Syncing…" : "Sync from Foreplay"}
            </button>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {(foreplayData?.ads ?? []).map((ad) => (
              <div
                key={ad.id}
                className="rounded-lg border border-border bg-surface p-4 flex flex-col"
              >
                {ad.imageUrl && (
                  <img
                    src={ad.imageUrl}
                    alt=""
                    className="w-full h-36 object-cover rounded mb-3"
                  />
                )}
                <p className="font-medium text-sm line-clamp-1">{ad.headline || ad.domain || ad.id}</p>
                {ad.pageName && (
                  <p className="text-xs text-muted mt-0.5">{ad.pageName}</p>
                )}
                {ad.body && (
                  <p className="text-sm text-muted mt-1 line-clamp-3">{ad.body}</p>
                )}
                <button
                  type="button"
                  onClick={() => handleAnalyze("foreplay", ad.id)}
                  disabled={analyzingId === ad.id}
                  className="mt-3 text-sm text-accent hover:underline disabled:opacity-50"
                >
                  {analyzingId === ad.id ? "Analyzing…" : "Analyze with Claude"}
                </button>
              </div>
            ))}
          </div>
          {foreplayData && foreplayData.ads.length === 0 && (
            <p className="text-sm text-muted">No Foreplay ads. Sync using your brand domain or add search terms in the API.</p>
          )}
        </>
      )}

      {sourceTab === "ads_library" && (
        <>
          <div className="flex flex-wrap gap-2 items-end">
            <div>
              <label className="block text-xs text-muted mb-1">Search terms</label>
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="e.g. wine club"
                className="px-3 py-2 text-sm border border-border rounded-lg bg-surface min-w-[200px]"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Countries (comma-separated)</label>
              <input
                type="text"
                value={searchCountries}
                onChange={(e) => setSearchCountries(e.target.value)}
                placeholder="US"
                className="px-3 py-2 text-sm border border-border rounded-lg bg-surface w-24"
              />
            </div>
            <button
              type="button"
              onClick={handleAdsLibrarySearch}
              disabled={searchBusy || !searchQuery.trim()}
              className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:opacity-90 disabled:opacity-50"
            >
              {searchBusy ? "Searching…" : "Search"}
            </button>
          </div>
          {adsLibraryData?.searchedAt && (
            <p className="text-sm text-muted">
              Last search: &quot;{adsLibraryData.query}&quot; at {new Date(adsLibraryData.searchedAt).toLocaleString()}
            </p>
          )}
          <div className="grid gap-4 sm:grid-cols-2">
            {(adsLibraryData?.results ?? []).map((ad) => (
              <div
                key={ad.id}
                className="rounded-lg border border-border bg-surface p-4 flex flex-col"
              >
                {ad.ad_snapshot_url && (
                  <img
                    src={ad.ad_snapshot_url}
                    alt=""
                    className="w-full h-36 object-cover rounded mb-3"
                  />
                )}
                <p className="font-medium text-sm">{ad.page_name || ad.id}</p>
                {ad.ad_creative_bodies?.[0] && (
                  <p className="text-sm text-muted mt-1 line-clamp-3">{ad.ad_creative_bodies[0]}</p>
                )}
                <button
                  type="button"
                  onClick={() => handleAnalyze("ads_library", ad.id)}
                  disabled={analyzingId === ad.id}
                  className="mt-3 text-sm text-accent hover:underline disabled:opacity-50"
                >
                  {analyzingId === ad.id ? "Analyzing…" : "Analyze with Claude"}
                </button>
              </div>
            ))}
          </div>
          {adsLibraryData && adsLibraryData.results.length === 0 && (
            <p className="text-sm text-muted">No results. Run a search above.</p>
          )}
        </>
      )}

      {analysisResult && (
        <div className="rounded-lg border border-border bg-surface p-5 mt-6">
          <h3 className="font-medium text-sm mb-2">Claude analysis</h3>
          <div className="text-sm text-muted whitespace-pre-wrap leading-relaxed">
            {analysisResult}
          </div>
        </div>
      )}
    </div>
  );
}
