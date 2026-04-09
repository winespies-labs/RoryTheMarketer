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
const PREVIEW_LENGTH = 220;

interface ReviewRow {
  id: string;
  title?: string;
  content: string;
  source?: string;
  starred?: boolean;
  topics?: string[];
  rating?: number;
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

type Tab = "all" | "favorites";
type SourceFilter = "" | "trustpilot" | "app_store";

function Stars({ n, max = 5 }: { n?: number; max?: number }) {
  if (!n) return null;
  return (
    <span
      className="text-amber-500 text-sm tracking-tight"
      aria-label={`${n} out of ${max} stars`}
    >
      {"★".repeat(n)}
      {"☆".repeat(max - n)}
    </span>
  );
}

function SourceBadge({ source }: { source?: string }) {
  if (!source || source === "unknown") return null;
  const label =
    source === "trustpilot"
      ? "Trustpilot"
      : source === "app_store"
        ? "App Store"
        : source;
  const cls =
    source === "trustpilot"
      ? "text-emerald-700 bg-emerald-50 border-emerald-200"
      : "text-blue-700 bg-blue-50 border-blue-200";
  return (
    <span className={`text-xs px-2 py-0.5 rounded border font-medium ${cls}`}>
      {label}
    </span>
  );
}

export default function ReviewsPanel() {
  const [data, setData] = useState<ReviewsApiResponse | null>(null);
  const [activeTab, setActiveTab] = useState<Tab>("all");
  const [q, setQ] = useState("");
  const deferredQ = useDeferredValue(q);
  const [source, setSource] = useState<SourceFilter>("");
  const [minRating, setMinRating] = useState(0);
  const [activeTopic, setActiveTopic] = useState("");
  const [manageOpen, setManageOpen] = useState(false);
  const [expandedIds, setExpandedIds] = useState<Set<string>>(new Set());
  const [loadBusy, setLoadBusy] = useState(false);
  const [patchBusy, setPatchBusy] = useState<string | null>(null);

  // Manage section
  const [channelId, setChannelId] = useState("");
  const [slackChannelConfigured, setSlackChannelConfigured] = useState(false);
  const [syncBusy, setSyncBusy] = useState(false);
  const [uploadBusy, setUploadBusy] = useState(false);
  const [uploadSource, setUploadSource] = useState<"trustpilot" | "app_store">(
    "trustpilot"
  );
  const fileInputRef = useRef<HTMLInputElement>(null);

  const starredOnly = activeTab === "favorites";

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
      if (activeTopic.trim()) params.set("topic", activeTopic.trim());
      if (starredOnly) params.set("starred", "true");
      if (source) params.set("source", source);
      if (minRating > 0) params.set("minRating", String(minRating));
      return params;
    },
    [deferredQ, activeTopic, starredOnly, source, minRating]
  );

  const fetchPage = useCallback(
    async (offset: number, append: boolean) => {
      setLoadBusy(true);
      try {
        const res = await fetch(`/api/reviews?${buildParams(offset)}`);
        const d = (await res.json()) as ReviewsApiResponse;
        if (!res.ok) throw new Error((d as unknown as { error?: string }).error);
        if (append && offset > 0) {
          setData((prev) => {
            if (!prev) return d;
            return { ...d, reviews: [...prev.reviews, ...d.reviews] };
          });
        } else {
          setData(d);
        }
      } catch {
        if (!append) setData(null);
      } finally {
        setLoadBusy(false);
      }
    },
    [buildParams]
  );

  useEffect(() => {
    void fetchPage(0, false);
  }, [fetchPage]);

  // Clear expanded state when filters change
  useEffect(() => {
    setExpandedIds(new Set());
  }, [activeTab, source, minRating, activeTopic, deferredQ]);

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
            !prev.topicsInUse.some((u) => u.toLowerCase() === t.toLowerCase())
        );
        const mergedTopics = added?.length
          ? [...prev.topicsInUse, ...added].sort((a, b) =>
              a.localeCompare(b, undefined, { sensitivity: "base" })
            )
          : prev.topicsInUse;
        let nextReviews = prev.reviews.map((r) =>
          r.id === id ? { ...r, ...nextRow } : r
        );
        // Remove from favorites view if unstarred
        if (starredOnly && patch.starred === false) {
          nextReviews = nextReviews.filter((r) => r.id !== id);
        }
        return { ...prev, topicsInUse: mergedTopics, reviews: nextReviews };
      });
    } catch (e) {
      alert(e instanceof Error ? e.message : "Update failed");
    } finally {
      setPatchBusy(null);
    }
  };

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

  const topicOptions = useMemo(() => {
    const fromApi = data?.topicsInUse ?? [];
    const merged = new Map<string, string>();
    for (const t of REVIEW_TOPIC_PRESETS) merged.set(t.toLowerCase(), t);
    for (const t of fromApi) merged.set(t.toLowerCase(), t);
    return Array.from(merged.values()).sort((a, b) =>
      a.localeCompare(b, undefined, { sensitivity: "base" })
    );
  }, [data?.topicsInUse]);

  const toggleExpand = (id: string) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const isFiltered = !!(
    deferredQ.trim() ||
    activeTopic ||
    source ||
    minRating > 0
  );
  const resultLabel = data
    ? isFiltered
      ? `${data.matchCount} of ${data.storeTotal} reviews`
      : `${data.storeTotal} review${data.storeTotal !== 1 ? "s" : ""}`
    : null;

  return (
    <div className="max-w-4xl">
      {/* Header */}
      <div className="flex items-start justify-between mb-6 gap-4">
        <div>
          <h1 className="text-xl font-semibold text-foreground">
            Customer Reviews
          </h1>
          {data?.updatedAt && (
            <p className="text-sm text-muted mt-0.5">
              Last synced: {new Date(data.updatedAt).toLocaleString()}
              {data.slackChannelId && (
                <span className="ml-1">· {data.slackChannelId}</span>
              )}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            type="button"
            onClick={handleSyncSlack}
            disabled={syncBusy}
            className="px-3 py-1.5 text-sm font-medium border border-border rounded-lg hover:bg-surface transition-colors disabled:opacity-50"
          >
            {syncBusy ? "Syncing…" : "↻ Sync"}
          </button>
          <button
            type="button"
            onClick={() => setManageOpen((o) => !o)}
            className="px-3 py-1.5 text-sm font-medium border border-border rounded-lg hover:bg-surface transition-colors"
          >
            {manageOpen ? "▴ Manage" : "▾ Manage"}
          </button>
        </div>
      </div>

      {/* Manage (collapsible) */}
      {manageOpen && (
        <div className="mb-6 rounded-lg border border-border bg-surface p-4 space-y-4">
          {/* Slack */}
          <div className="space-y-1.5">
            <div className="text-xs font-semibold text-muted uppercase tracking-wide">
              Slack Sync
            </div>
            {slackChannelConfigured ? (
              <p className="text-sm text-muted">
                Channel configured via{" "}
                <code className="text-xs bg-muted/20 px-1 rounded">
                  SLACK_REVIEWS_CHANNEL_ID
                </code>
                . Daily sync runs automatically in production.
              </p>
            ) : (
              <>
                <p className="text-xs text-muted">
                  Set{" "}
                  <code className="bg-muted/20 px-1 rounded">
                    SLACK_REVIEWS_CHANNEL_ID
                  </code>{" "}
                  for automatic daily sync, or paste a channel ID below.
                </p>
                <div className="flex flex-wrap gap-2 items-center">
                  <input
                    type="text"
                    value={channelId}
                    onChange={(e) => setChannelId(e.target.value)}
                    placeholder="e.g. C01234ABCD"
                    className="px-3 py-1.5 text-sm border border-border rounded-lg bg-background min-w-[200px]"
                  />
                  <button
                    type="button"
                    onClick={handleSyncSlack}
                    disabled={syncBusy}
                    className="px-3 py-1.5 text-sm font-medium bg-accent text-white rounded-lg hover:opacity-90 disabled:opacity-50"
                  >
                    {syncBusy ? "Syncing…" : "Sync now"}
                  </button>
                </div>
              </>
            )}
          </div>

          {/* Upload */}
          <div className="space-y-1.5 pt-3 border-t border-border">
            <div className="text-xs font-semibold text-muted uppercase tracking-wide">
              Upload Past Reviews
            </div>
            <p className="text-xs text-muted">
              CSV with Review Title / Review Content columns, or JSON:{" "}
              <code className="bg-muted/20 px-1 rounded">
                {"{ reviews: [{ title, content }] }"}
              </code>
            </p>
            <div className="flex flex-wrap gap-2 items-center">
              <select
                value={uploadSource}
                onChange={(e) =>
                  setUploadSource(e.target.value as "trustpilot" | "app_store")
                }
                className="px-3 py-1.5 text-sm border border-border rounded-lg bg-background"
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
                className="px-3 py-1.5 text-sm font-medium border border-border rounded-lg hover:bg-background disabled:opacity-50"
              >
                {uploadBusy ? "Uploading…" : "Choose file…"}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-end gap-1 mb-4 border-b border-border">
        {(
          [
            { id: "all", label: "All Reviews" },
            { id: "favorites", label: "★ Favorites" },
          ] as const
        ).map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={`px-4 py-2 text-sm font-medium transition-colors -mb-px ${
              activeTab === tab.id
                ? "text-accent border-b-2 border-accent"
                : "text-muted hover:text-foreground"
            }`}
          >
            {tab.label}
          </button>
        ))}
        {resultLabel && (
          <span className="ml-auto pb-2 text-sm text-muted">{resultLabel}</span>
        )}
      </div>

      {/* Filters */}
      <div className="space-y-3 mb-5">
        <input
          type="search"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Search reviews…"
          className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
        />

        <div className="flex flex-wrap gap-x-5 gap-y-2 items-center">
          {/* Source filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted shrink-0">Source:</span>
            {(
              [
                { val: "" as SourceFilter, label: "All" },
                { val: "trustpilot" as SourceFilter, label: "Trustpilot" },
                { val: "app_store" as SourceFilter, label: "App Store" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.val}
                type="button"
                onClick={() => setSource(opt.val)}
                className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                  source === opt.val
                    ? "bg-accent text-white border-accent"
                    : "border-border text-muted hover:border-accent hover:text-accent"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>

          {/* Rating filter */}
          <div className="flex items-center gap-1.5">
            <span className="text-xs text-muted shrink-0">Rating:</span>
            {(
              [
                { val: 0, label: "Any" },
                { val: 3, label: "3★+" },
                { val: 4, label: "4★+" },
                { val: 5, label: "5★" },
              ] as const
            ).map((opt) => (
              <button
                key={opt.val}
                type="button"
                onClick={() => setMinRating(opt.val)}
                className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                  minRating === opt.val
                    ? "bg-accent text-white border-accent"
                    : "border-border text-muted hover:border-accent hover:text-accent"
                }`}
              >
                {opt.label}
              </button>
            ))}
          </div>
        </div>

        {/* Topic pills */}
        <div className="flex flex-wrap gap-1.5 items-center">
          <span className="text-xs text-muted shrink-0">Topic:</span>
          <button
            type="button"
            onClick={() => setActiveTopic("")}
            className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
              activeTopic === ""
                ? "bg-accent text-white border-accent"
                : "border-border text-muted hover:border-accent hover:text-accent"
            }`}
          >
            All
          </button>
          {topicOptions.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setActiveTopic(activeTopic === t ? "" : t)}
              className={`px-2.5 py-1 text-xs rounded-full border transition-colors ${
                activeTopic === t
                  ? "bg-accent text-white border-accent"
                  : "border-border text-muted hover:border-accent hover:text-accent"
              }`}
            >
              {t}
            </button>
          ))}
        </div>
      </div>

      {/* Reviews list */}
      {data && data.reviews.length > 0 ? (
        <>
          <ul className="space-y-3">
            {data.reviews.map((r) => {
              const isExpanded = expandedIds.has(r.id);
              const needsTruncation = r.content.length > PREVIEW_LENGTH;
              const displayContent =
                needsTruncation && !isExpanded
                  ? r.content.slice(0, PREVIEW_LENGTH) + "…"
                  : r.content;

              return (
                <li
                  key={r.id}
                  className="rounded-lg border border-border bg-background p-4"
                >
                  <div className="flex gap-3 justify-between items-start">
                    <div className="min-w-0 flex-1 space-y-1.5">
                      {/* Stars + title */}
                      <div className="flex items-center gap-2 flex-wrap">
                        <Stars n={r.rating} />
                        {r.title && (
                          <span className="font-medium text-foreground text-sm">
                            {r.title}
                          </span>
                        )}
                      </div>

                      {/* Content */}
                      <p className="text-sm text-muted whitespace-pre-wrap break-words">
                        {displayContent}
                      </p>
                      {needsTruncation && (
                        <button
                          type="button"
                          onClick={() => toggleExpand(r.id)}
                          className="text-xs text-accent hover:underline"
                        >
                          {isExpanded ? "Show less" : "Read more"}
                        </button>
                      )}

                      {/* Source + Topics */}
                      <div className="flex flex-wrap gap-1.5 items-center pt-1">
                        <SourceBadge source={r.source} />
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
                                (x) => x.toLowerCase() === p.toLowerCase()
                              )
                          )}
                          disabled={patchBusy === r.id}
                          onAdd={(label) => {
                            const cur = r.topics ?? [];
                            if (
                              cur.some(
                                (x) => x.toLowerCase() === label.toLowerCase()
                              )
                            )
                              return;
                            patchReview(r.id, { topics: [...cur, label] });
                          }}
                        />
                      </div>
                    </div>

                    {/* Favorite star */}
                    <button
                      type="button"
                      disabled={patchBusy === r.id}
                      onClick={() =>
                        patchReview(r.id, { starred: !r.starred })
                      }
                      className={`shrink-0 text-xl leading-none px-1 transition-colors disabled:opacity-40 ${
                        r.starred
                          ? "text-amber-500 hover:text-amber-400"
                          : "text-muted hover:text-amber-500"
                      }`}
                      title={r.starred ? "Remove from favorites" : "Add to favorites"}
                    >
                      {r.starred ? "★" : "☆"}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>

          {data.hasMore && (
            <button
              type="button"
              disabled={loadBusy}
              onClick={() => void fetchPage(data.reviews.length, true)}
              className="mt-4 text-sm font-medium text-accent hover:underline disabled:opacity-50"
            >
              {loadBusy ? "Loading…" : "Load more"}
            </button>
          )}
        </>
      ) : data && data.storeTotal === 0 ? (
        <p className="text-sm text-muted py-10 text-center">
          No reviews yet — use{" "}
          <button
            type="button"
            onClick={() => setManageOpen(true)}
            className="text-accent hover:underline"
          >
            Manage
          </button>{" "}
          to sync from Slack or upload a file.
        </p>
      ) : data && data.matchCount === 0 ? (
        <p className="text-sm text-muted py-10 text-center">
          No reviews match these filters.
        </p>
      ) : (
        <p className="text-sm text-muted py-4">Loading…</p>
      )}
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
          className="text-xs px-2 py-0.5 rounded-full border border-dashed border-border text-muted hover:border-accent hover:text-accent"
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
            placeholder="Custom…"
            className="text-xs px-2 py-1 border border-border rounded bg-background w-28"
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
