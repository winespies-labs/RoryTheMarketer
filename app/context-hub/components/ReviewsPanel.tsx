"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const BRAND_ID = "winespies";

interface ReviewsApiResponse {
  reviews: { id: string; title?: string; content: string; source?: string }[];
  total: number;
  updatedAt?: string;
  slackChannelId?: string;
}

export default function ReviewsPanel({
  onChanged,
}: {
  onChanged?: () => void;
}) {
  const [data, setData] = useState<ReviewsApiResponse | null>(null);
  const [channelId, setChannelId] = useState("");
  const [syncBusy, setSyncBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [themesBusy, setThemesBusy] = useState(false);
  const [themesInfo, setThemesInfo] = useState<{ generatedAt?: string; summary?: string } | null>(null);
  const [uploadSource, setUploadSource] = useState<"trustpilot" | "app_store">("trustpilot");
  const [q, setQ] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchReviews = useCallback(() => {
    const params = new URLSearchParams({ brand: BRAND_ID });
    if (q) params.set("q", q);
    fetch(`/api/reviews?${params}`)
      .then((r) => r.json())
      .then((d) => setData(d))
      .catch(() => setData(null));
  }, [q]);

  const fetchThemes = useCallback(() => {
    fetch(`/api/review-themes?brand=${BRAND_ID}`)
      .then((r) => r.json())
      .then((d) => setThemesInfo(d))
      .catch(() => setThemesInfo(null));
  }, []);

  useEffect(() => {
    fetchReviews();
    fetchThemes();
  }, [fetchReviews, fetchThemes]);

  const handleSyncSlack = async () => {
    setSyncBusy(true);
    try {
      const body: { brand: string; channelId?: string } = { brand: BRAND_ID };
      if (channelId.trim()) body.channelId = channelId.trim();
      const res = await fetch("/api/reviews/sync-slack", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Sync failed");
      fetchReviews();
      onChanged?.();
    } catch (e) {
      alert(e instanceof Error ? e.message : "Sync failed");
    } finally {
      setSyncBusy(false);
    }
  };

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadBusy(true);
    try {
      const form = new FormData();
      form.set("brand", BRAND_ID);
      form.set("file", file);
      form.set("source", uploadSource);
      const res = await fetch("/api/reviews/upload", {
        method: "POST",
        body: form,
      });
      const result = await res.json();
      if (!res.ok) throw new Error(result.error ?? "Upload failed");
      fetchReviews();
      onChanged?.();
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadBusy(false);
    }
  };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Reviews (Slack & upload)</h2>

      <div className="rounded-lg border border-border bg-surface p-5 space-y-5">
        <p className="text-sm text-muted">
          Pull reviews from your Slack channel that posts Trustpilot and App Store reviews, or upload past exports (CSV or JSON).
        </p>

        <div className="flex flex-wrap items-end justify-between gap-4">
          <div className="text-sm text-muted">
            {data?.updatedAt
              ? `Last updated: ${new Date(data.updatedAt).toLocaleString()}`
              : "No reviews yet"}
            {data != null && (
              <span className="ml-2">
                — {data.total} review{data.total !== 1 ? "s" : ""}
              </span>
            )}
            {data?.slackChannelId && (
              <span className="block text-xs mt-0.5">
                Slack channel: {data.slackChannelId}
              </span>
            )}
          </div>
        </div>

        {/* Slack sync */}
        <div className="space-y-2">
          <label className="block text-xs text-muted font-medium">
            Slack channel ID (optional if set in env as SLACK_REVIEWS_CHANNEL_ID)
          </label>
          <div className="flex flex-wrap gap-2 items-center">
            <input
              type="text"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              placeholder="e.g. C01234ABCD"
              className="px-3 py-2 text-sm border border-border rounded-lg bg-background min-w-[200px]"
            />
            <button
              onClick={handleSyncSlack}
              disabled={syncBusy}
              className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {syncBusy ? "Syncing…" : "Sync from Slack"}
            </button>
          </div>
        </div>

        {/* Generate themes */}
        <div className="space-y-2">
          <label className="block text-xs text-muted font-medium">
            Review themes — optional summary (Rory chat already receives review snippets from storage)
          </label>
          <div className="flex flex-wrap gap-2 items-center">
            <button
              onClick={async () => {
                setThemesBusy(true);
                try {
                  const res = await fetch("/api/review-themes", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ brand: BRAND_ID }),
                  });
                  const result = await res.json();
                  if (!res.ok) throw new Error(result.error ?? "Failed");
                  fetchThemes();
                  onChanged?.();
                } catch (e) {
                  alert(e instanceof Error ? e.message : "Failed to generate themes");
                } finally {
                  setThemesBusy(false);
                }
              }}
              disabled={themesBusy || !data?.total}
              className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              {themesBusy ? "Generating…" : "Generate Themes"}
            </button>
            {themesInfo?.generatedAt && (
              <span className="text-xs text-muted">
                Last generated: {new Date(themesInfo.generatedAt).toLocaleString()}
              </span>
            )}
          </div>
          {themesInfo?.summary && (
            <div className="mt-2 rounded-lg border border-border bg-background p-3 text-sm text-muted max-h-48 overflow-y-auto whitespace-pre-wrap">
              {themesInfo.summary}
            </div>
          )}
        </div>

        {/* Upload */}
        <div className="space-y-2">
          <label className="block text-xs text-muted font-medium">
            Upload past reviews (CSV or JSON)
          </label>
          <p className="text-xs text-muted">
            CSV: columns like Review Title, Review Content (and optional Review User Email). JSON:{" "}
            <code className="bg-muted px-1 rounded">{"{ reviews: [{ title, content }] }"}</code>
          </p>
          <div className="flex flex-wrap gap-2 items-center">
            <select
              value={uploadSource}
              onChange={(e) => setUploadSource(e.target.value as "trustpilot" | "app_store")}
              className="px-3 py-2 text-sm border border-border rounded-lg bg-background"
            >
              <option value="trustpilot">Trustpilot</option>
              <option value="app_store">App Store</option>
            </select>
            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,.json,text/csv,application/json"
              onChange={handleUpload}
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploadBusy}
              className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-background transition-colors disabled:opacity-50"
            >
              {uploadBusy ? "Uploading…" : "Choose file…"}
            </button>
          </div>
        </div>

        {/* Search and list */}
        <div className="pt-2 border-t border-border">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search reviews…"
            className="w-full max-w-sm px-3 py-2 text-sm border border-border rounded-lg bg-background mb-3"
          />
          {data?.reviews && data.reviews.length > 0 ? (
            <ul className="space-y-2 max-h-64 overflow-y-auto text-sm">
              {data.reviews.slice(0, 20).map((r) => (
                <li
                  key={r.id}
                  className="rounded-lg border border-border bg-background p-3"
                >
                  {r.title && (
                    <div className="font-medium text-foreground mb-1">{r.title}</div>
                  )}
                  <div className="text-muted line-clamp-2">{r.content}</div>
                  {r.source && r.source !== "unknown" && (
                    <span className="text-xs text-muted mt-1 inline-block">
                      {r.source}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm text-muted">No reviews yet. Sync from Slack or upload a file.</p>
          )}
        </div>
      </div>
    </div>
  );
}
