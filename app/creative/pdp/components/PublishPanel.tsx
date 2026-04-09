// app/creative/pdp/components/PublishPanel.tsx
"use client";

import { useEffect, useState } from "react";
import type { GenerationJob } from "../hooks/useGenerator";

interface AdSet {
  id: string;
  name: string;
  status: string;
  effective_status: string;
}

interface AdCopy {
  headline: string;
  primary_text: string;
  description: string;
}

type PublishStatus = "idle" | "publishing" | "done" | "error";

interface JobPublishState {
  copy: AdCopy;
  status: PublishStatus;
  error?: string;
  metaAdId?: string;
}

function buildDefaultCopy(job: GenerationJob): AdCopy {
  return {
    headline: job.wineName,
    primary_text: `Now just ${job.wineName}. Limited time — don't miss it.`,
    description: "Shop Wine Spies today →",
  };
}

interface PublishPanelProps {
  jobs: GenerationJob[];
  onBack: () => void;
}

export default function PublishPanel({ jobs, onBack }: PublishPanelProps) {
  const [adSets, setAdSets] = useState<AdSet[]>([]);
  const [adSetsLoading, setAdSetsLoading] = useState(true);
  const [adSetsError, setAdSetsError] = useState<string | null>(null);
  const [selectedAdSetId, setSelectedAdSetId] = useState<string>("");
  const [newAdSetName, setNewAdSetName] = useState("");
  const [useNewAdSet, setUseNewAdSet] = useState(false);
  const [jobStates, setJobStates] = useState<Record<string, JobPublishState>>(
    () =>
      Object.fromEntries(
        jobs.map((j) => [j.id, { copy: buildDefaultCopy(j), status: "idle" as PublishStatus }])
      )
  );
  const [publishing, setPublishing] = useState(false);

  useEffect(() => {
    async function loadAdSets() {
      try {
        const res = await fetch("/api/pdp/publish?action=adsets&brand=winespies");
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const data = await res.json() as { adSets: AdSet[] };
        setAdSets(data.adSets ?? []);
        if (data.adSets?.length > 0) setSelectedAdSetId(data.adSets[0].id);
      } catch (err) {
        setAdSetsError(err instanceof Error ? err.message : "Failed to load ad sets");
      } finally {
        setAdSetsLoading(false);
      }
    }
    loadAdSets();
  }, []);

  function updateCopy(jobId: string, field: keyof AdCopy, value: string) {
    setJobStates((prev) => ({
      ...prev,
      [jobId]: {
        ...prev[jobId],
        copy: { ...prev[jobId].copy, [field]: value },
      },
    }));
  }

  async function handlePublish() {
    const adSetId = useNewAdSet ? null : selectedAdSetId;
    if (!useNewAdSet && !adSetId) return;
    if (useNewAdSet && !newAdSetName.trim()) return;

    setPublishing(true);

    const publishJobs = jobs.map((job) => ({
      jobId: job.id,
      imageBase64: job.imageBase64!,
      mimeType: job.mimeType,
      wineName: job.wineName,
      ...jobStates[job.id].copy,
      saleUrl: `https://winespies.com/sales/${job.saleId}`,
    }));

    setJobStates((prev) =>
      Object.fromEntries(
        Object.entries(prev).map(([id, state]) => [
          id,
          { ...state, status: "publishing" as PublishStatus },
        ])
      )
    );

    try {
      const res = await fetch("/api/pdp/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: "winespies",
          adSetId: useNewAdSet ? null : adSetId,
          newAdSetName: useNewAdSet ? newAdSetName.trim() : null,
          jobs: publishJobs,
        }),
      });

      const data = await res.json() as {
        results: Array<{ jobId: string; success: boolean; adId?: string; error?: string }>;
      };

      setJobStates((prev) => {
        const next = { ...prev };
        for (const r of data.results ?? []) {
          next[r.jobId] = {
            ...next[r.jobId],
            status: r.success ? "done" : "error",
            metaAdId: r.adId,
            error: r.error,
          };
        }
        return next;
      });
    } catch (err) {
      setJobStates((prev) =>
        Object.fromEntries(
          Object.entries(prev).map(([id, state]) => [
            id,
            { ...state, status: "error" as PublishStatus, error: err instanceof Error ? err.message : "Failed" },
          ])
        )
      );
    } finally {
      setPublishing(false);
    }
  }

  const allDone = jobs.every((j) => jobStates[j.id]?.status === "done");
  const anyPublishing = jobs.some((j) => jobStates[j.id]?.status === "publishing");

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold">Publish to Meta</h2>
          <p className="text-sm text-muted mt-0.5">
            Review copy for each ad, choose an ad set, and publish.
          </p>
        </div>
        <button
          onClick={onBack}
          className="px-3 py-2 text-sm text-muted hover:text-foreground transition-colors shrink-0"
        >
          ← Back
        </button>
      </div>

      <div className="border border-border rounded-xl p-4 flex flex-col gap-3 bg-surface">
        <div className="text-sm font-medium text-foreground">Destination Ad Set</div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setUseNewAdSet(false)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              !useNewAdSet ? "border-accent bg-accent/10 text-accent" : "border-border text-muted hover:text-foreground"
            }`}
          >
            Existing
          </button>
          <button
            type="button"
            onClick={() => setUseNewAdSet(true)}
            className={`px-3 py-1.5 text-sm rounded-lg border transition-colors ${
              useNewAdSet ? "border-accent bg-accent/10 text-accent" : "border-border text-muted hover:text-foreground"
            }`}
          >
            New Ad Set
          </button>
        </div>

        {!useNewAdSet && (
          adSetsLoading ? (
            <div className="text-sm text-muted">Loading ad sets…</div>
          ) : adSetsError ? (
            <div className="text-sm text-danger">{adSetsError}</div>
          ) : (
            <select
              value={selectedAdSetId}
              onChange={(e) => setSelectedAdSetId(e.target.value)}
              className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-accent"
            >
              {adSets.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name} ({s.effective_status})
                </option>
              ))}
            </select>
          )
        )}

        {useNewAdSet && (
          <input
            type="text"
            placeholder="New ad set name"
            value={newAdSetName}
            onChange={(e) => setNewAdSetName(e.target.value)}
            className="px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-accent"
          />
        )}
      </div>

      <div className="flex flex-col gap-3">
        {jobs.map((job) => {
          const state = jobStates[job.id];
          if (!state) return null;
          return (
            <div key={job.id} className="border border-border rounded-xl overflow-hidden">
              <div className="flex gap-4 p-4">
                {job.imageBase64 && (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={`data:${job.mimeType};base64,${job.imageBase64}`}
                    alt={job.wineName}
                    className="w-20 h-20 object-contain rounded-lg bg-background shrink-0"
                  />
                )}
                <div className="flex-1 flex flex-col gap-2 min-w-0">
                  <div className="text-sm font-semibold text-foreground">{job.wineName}</div>
                  <div className="text-xs text-muted">{job.styleName}</div>
                  <div>
                    <label className="text-[10px] font-semibold text-muted uppercase tracking-wide block mb-1">Headline</label>
                    <input
                      type="text"
                      value={state.copy.headline}
                      onChange={(e) => updateCopy(job.id, "headline", e.target.value)}
                      disabled={state.status === "done"}
                      className="w-full px-2.5 py-1.5 text-sm border border-border rounded-lg bg-surface focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-muted uppercase tracking-wide block mb-1">Primary Text</label>
                    <textarea
                      value={state.copy.primary_text}
                      onChange={(e) => updateCopy(job.id, "primary_text", e.target.value)}
                      disabled={state.status === "done"}
                      rows={2}
                      className="w-full px-2.5 py-1.5 text-sm border border-border rounded-lg bg-surface focus:outline-none focus:ring-1 focus:ring-accent resize-none disabled:opacity-50"
                    />
                  </div>
                  <div>
                    <label className="text-[10px] font-semibold text-muted uppercase tracking-wide block mb-1">Description</label>
                    <input
                      type="text"
                      value={state.copy.description}
                      onChange={(e) => updateCopy(job.id, "description", e.target.value)}
                      disabled={state.status === "done"}
                      className="w-full px-2.5 py-1.5 text-sm border border-border rounded-lg bg-surface focus:outline-none focus:ring-1 focus:ring-accent disabled:opacity-50"
                    />
                  </div>
                </div>
                <div className="shrink-0 flex items-start pt-1">
                  {state.status === "idle" && <span className="text-xs text-muted">Ready</span>}
                  {state.status === "publishing" && <span className="text-xs text-accent animate-pulse">Publishing…</span>}
                  {state.status === "done" && <span className="text-xs text-success font-medium">✅ Published</span>}
                  {state.status === "error" && <span className="text-xs text-danger" title={state.error}>Failed</span>}
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {!allDone && (
        <div className="flex justify-end">
          <button
            onClick={handlePublish}
            disabled={publishing || anyPublishing || (!useNewAdSet && !selectedAdSetId) || (useNewAdSet && !newAdSetName.trim())}
            className="px-6 py-2.5 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {publishing ? "Publishing…" : `Publish ${jobs.length} Ad${jobs.length !== 1 ? "s" : ""} to Meta`}
          </button>
        </div>
      )}

      {allDone && (
        <div className="text-center py-6 text-success font-medium">
          ✅ All {jobs.length} ads published to Meta successfully.
        </div>
      )}
    </div>
  );
}
