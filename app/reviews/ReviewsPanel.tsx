"use client";

import {
  useCallback,
  useDeferredValue,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { REVIEW_TOPIC_PRESETS } from "@/lib/reviews";

const BRAND_ID = "winespies";

interface ReviewRow {
  id: string;
  title?: string;
  content: string;
  source?: string;
  starred?: boolean;
  topics?: string[];
}

interface ReviewsApiResponse {
  reviews: ReviewRow[];
  storeTotal: number;
  matchCount: number;
  offset: number;
  limit: number;
  hasMore: boolean;
  updatedAt?: string;
  slackChannelId?: string;
  topicsInUse: string[];
}

export default function ReviewsPanel() {
  const [data, setData] = useState<ReviewsApiResponse | null>(null);
  const [channelId, setChannelId] = useState("");
  const [slackChannelConfigured, setSlackChannelConfigured] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadSource, setUploadSource] = useState<"trustpilot" | "app_store">(
    "trustpilot"
  );
  const [q, setQ] = useState("");
  const deferredQ = useDeferredValue(q);
  const [topic, setTopic] = useState("");
  const [starredOnly, setStarredOnly] = useState(false);
  const [loadBusy, setLoadBusy] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [patchBusy, setPatchBusy] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const listRef = useRef<HTMLUListElement>(null);

  useEffect(() => {
    fetch("/api/reviews/config")
      .then((r) => r.json())
      .then((d: { slackChannelConfigured?: boolean }) =>
        setSlackChannelConfigured(!!d.slackChannelConfigured)
      )
      .catch(() => setSlackChannelConfigured(false));
  }, []);

  const buildParams = useCallback(
    (offset: number) => {
      const params = new URLSearchParams({
        brand: BRAND_ID,
        limit: "50",
        offset: String(offset),
      });
      if (deferredQ.trim()) params.set("q", deferredQ.trim());
      if (topic.trim()) params.set("topic", topic.trim());
      if (starredOnly) params.set("starred", "true");
      return params;
    },
    [deferredQ, topic, starredOnly]
  );

  const fetchPage = useCallback(
    async (offset: number, append: boolean) => {
      setLoadBusy(true);
      setLoadError(null);
      try {
        const res = await fetch(`/api/reviews?${buildParams(offset)}`);
        const d = (await res.json()) as ReviewsApiResponse;
        if (!res.ok) throw new Error((d as unknown as { error?: string }).error);
        if (append && offset > 0) {
          setData((prev) => {
            if (!prev) return d;
            return {
              ...d,
              reviews: [...prev.reviews, ...d.reviews],
            };
          });
          setTimeout(() => {
            listRef.current?.scrollTo({ top: listRef.current.scrollHeight, behavior: "smooth" });
          }, 0);
        } else {
          setData(d);
        }
      } catch (e) {
        if (!append) setData(null);
        else setLoadError(e instanceof Error ? e.message : "Failed to load more reviews");
      } finally {
        setLoadBusy(false);
      }
    },
    [buildParams]
  );

  useEffect(() => {
    void fetchPage(0, false);
  }, [fetchPage]);

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
      void fetchPage(0, false);
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
      void fetchPage(0, false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } catch (err) {
      alert(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploadBusy(false);
    }
  };

  const patchReview = async (
    id: string,
    patch: { starred?: boolean; topics?: string[] }
  ) => {
    setPatchBusy(id);
    try {
      const res = await fetch(`/api/reviews/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand: BRAND_ID, ...patch }),
      });
      const result = (await res.json()) as {
        review?: ReviewRow;
        error?: string;
      };
      if (!res.ok) throw new Error(result.error ?? "Update failed");
      const nextRow = result.review;
      if (!nextRow) throw new Error("Update failed");
      setData((prev) => {
        if (!prev) return prev;
        const added = nextRow.topics?.filter(
          (t) =>
            !prev.topicsInUse.some(
              (u) => u.toLowerCase() === t.toLowerCase()
            )
        );
        const mergedTopics =
          added?.length
            ? [...prev.topicsInUse, ...added].sort((a, b) =>
                a.localeCompare(b, undefined, { sensitivity: "base" })
              )
            : prev.topicsInUse;
        return {
          ...prev,
          topicsInUse: mergedTopics,
          reviews: prev.reviews.map((r) =>
            r.id === id ? { ...r, ...nextRow } : r
          ),
        };
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Update failed");
    } finally {
      setPatchBusy(null);
    }
  };

  const topicOptions = useMemo(() => {
    const fromApi = data?.topicsInUse ?? [];
    const merged = new Map<string, string>();
    for (const t of REVIEW_TOPIC_PRESETS) merged.set(t.toLowerCase(), t);
    for (const t of fromApi) merged.set(t.toLowerCase(), t);
    return Array.from(merged.values()).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );
  }, [data?.topicsInUse]);

  const summaryLine = data
    ? data.matchCount === data.storeTotal
      ? `${data.storeTotal} review${data.storeTotal !== 1 ? "s" : ""}`
      : `${data.matchCount} matching — ${data.storeTotal} total`
    : null;

  return (
    <div>
      <div className="space-y-4">
        {/* Actions + status row */}
        <div className="flex flex-wrap gap-2 items-center">
          <button
            type="button"
            onClick={handleSyncSlack}
            disabled={syncBusy}
            className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {syncBusy ? "Syncing…" : "Sync now"}
          </button>

          {!slackChannelConfigured && (
            <input
              type="text"
              value={channelId}
              onChange={(e) => setChannelId(e.target.value)}
              placeholder="Channel ID"
              className="px-3 py-2 text-sm border border-border rounded-lg bg-surface min-w-[160px]"
            />
          )}

          <select
            value={uploadSource}
            onChange={(e) =>
              setUploadSource(e.target.value as "trustpilot" | "app_store")
            }
            className="px-3 py-2 text-sm border border-border rounded-lg bg-surface"
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
            type="button"
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadBusy}
            className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-surface transition-colors disabled:opacity-50"
          >
            {uploadBusy ? "Uploading…" : "Upload CSV / JSON"}
          </button>

          <span className="text-xs text-muted ml-auto">
            {data?.updatedAt
              ? `Updated ${new Date(data.updatedAt).toLocaleDateString()}${summaryLine ? ` · ${summaryLine}` : ""}`
              : "No reviews yet"}
          </span>
        </div>

        {/* Search / filter row */}
        <div className="flex flex-wrap gap-2 items-center">
          <input
            type="search"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search reviews…"
            className="px-3 py-2 text-sm border border-border rounded-lg bg-surface min-w-[200px] flex-1"
          />
          <select
            value={topic}
            onChange={(e) => setTopic(e.target.value)}
            className="px-3 py-2 text-sm border border-border rounded-lg bg-surface"
          >
            <option value="">All topics</option>
            {topicOptions.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
          <label className="flex items-center gap-2 text-sm cursor-pointer">
            <input
              type="checkbox"
              checked={starredOnly}
              onChange={(e) => setStarredOnly(e.target.checked)}
              className="rounded border-border"
            />
            Starred only
          </label>
        </div>

        {/* Review list */}
        <div>
          {data && data.reviews.length > 0 ? (
            <>
              <ul ref={listRef} className="space-y-3 max-h-[min(28rem,70vh)] overflow-y-auto text-sm pr-1">
                {data.reviews.map((r) => (
                  <li
                    key={r.id}
                    className="rounded-lg border border-border bg-background p-3"
                  >
                    <div className="flex gap-2 justify-between items-start">
                      <div className="min-w-0 flex-1">
                        {r.title && (
                          <div className="font-medium text-foreground mb-1">
                            {r.title}
                          </div>
                        )}
                        <div className="text-muted whitespace-pre-wrap break-words">
                          {r.content}
                        </div>
                        <div className="flex flex-wrap gap-2 mt-2 items-center">
                          {r.source && r.source !== "unknown" && (
                            <span className="text-xs text-muted px-2 py-0.5 rounded bg-surface border border-border">
                              {r.source}
                            </span>
                          )}
                          {(r.topics ?? []).map((t) => (
                            <button
                              key={t}
                              type="button"
                              disabled={patchBusy === r.id}
                              onClick={() =>
                                patchReview(r.id, {
                                  topics: (r.topics ?? []).filter(
                                    (x) => x !== t
                                  ),
                                })
                              }
                              className="text-xs px-2 py-0.5 rounded-full border border-border bg-surface hover:bg-background inline-flex items-center gap-1"
                              title="Remove topic"
                            >
                              {t}
                              <span className="text-muted">×</span>
                            </button>
                          ))}
                          <TopicAddRow
                            presets={REVIEW_TOPIC_PRESETS.filter(
                              (p) =>
                                !(r.topics ?? []).some(
                                  (x) =>
                                    x.toLowerCase() === p.toLowerCase()
                                )
                            )}
                            disabled={patchBusy === r.id}
                            onAdd={(label) => {
                              const cur = r.topics ?? [];
                              if (
                                cur.some(
                                  (x) =>
                                    x.toLowerCase() === label.toLowerCase()
                                )
                              )
                                return;
                              patchReview(r.id, { topics: [...cur, label] });
                            }}
                          />
                        </div>
                      </div>
                      <button
                        type="button"
                        disabled={patchBusy === r.id}
                        onClick={() =>
                          patchReview(r.id, {
                            starred: !r.starred,
                          })
                        }
                        className="shrink-0 text-lg leading-none px-1 text-amber-600 hover:opacity-80 disabled:opacity-40"
                        title={r.starred ? "Unstar" : "Star"}
                        aria-label={r.starred ? "Unstar" : "Star"}
                      >
                        {r.starred ? "★" : "☆"}
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
              {data.hasMore && (
                <button
                  type="button"
                  disabled={loadBusy}
                  onClick={() => void fetchPage(data.reviews.length, true)}
                  className="text-sm font-medium text-accent hover:underline disabled:opacity-50"
                >
                  {loadBusy ? "Loading…" : "Load more"}
                </button>
              )}
              {loadError && (
                <p className="text-sm text-danger mt-1">{loadError}</p>
              )}
            </>
          ) : data && data.storeTotal === 0 ? (
            <p className="text-sm text-muted">
              No reviews yet. Sync from Slack or upload a file.
            </p>
          ) : data && data.matchCount === 0 ? (
            <p className="text-sm text-muted">No reviews match these filters.</p>
          ) : (
            <p className="text-sm text-muted">Loading…</p>
          )}
        </div>
      </div>
    </div>
  );
}

function TopicAddRow({
  presets,
  disabled,
  onAdd,
}: {
  presets: readonly string[];
  disabled: boolean;
  onAdd: (label: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const [custom, setCustom] = useState("");

  return (
    <div className="flex flex-wrap items-center gap-1">
      {!open ? (
        <button
          type="button"
          disabled={disabled}
          onClick={() => setOpen(true)}
          className="text-xs px-2 py-0.5 rounded border border-dashed border-border text-muted hover:border-accent hover:text-accent"
        >
          + Topic
        </button>
      ) : (
        <div className="flex flex-wrap items-center gap-1">
          <select
            className="text-xs px-2 py-1 border border-border rounded bg-background max-w-[10rem]"
            defaultValue=""
            disabled={disabled}
            onChange={(e) => {
              const v = e.target.value;
              if (v) {
                onAdd(v);
                e.target.value = "";
              }
            }}
          >
            <option value="">Preset…</option>
            {presets.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
          <input
            type="text"
            value={custom}
            disabled={disabled}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter" && custom.trim()) {
                onAdd(custom.trim());
                setCustom("");
              }
            }}
            placeholder="Custom topic"
            className="text-xs px-2 py-1 border border-border rounded bg-background w-32"
          />
          <button
            type="button"
            className="text-xs text-muted hover:text-foreground"
            onClick={() => {
              setOpen(false);
              setCustom("");
            }}
          >
            Done
          </button>
        </div>
      )}
    </div>
  );
}
