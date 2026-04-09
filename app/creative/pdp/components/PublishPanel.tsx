// app/creative/pdp/components/PublishPanel.tsx
"use client";

import { useEffect, useState } from "react";
import type { GenerationJob } from "../hooks/useGenerator";
import NewAdSetForm, {
  type NewAdSetFormState,
  DEFAULT_NEW_AD_SET,
} from "./NewAdSetForm";
import type { MetaCampaignLive, MetaAudience, NewAdSetInput } from "@/lib/meta-publish";

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

interface Preflight {
  ok: boolean;
  missing: string[];
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
  const [jobStates, setJobStates] = useState<Record<string, JobPublishState>>({});

  useEffect(() => {
    setJobStates((prev) => {
      const next: Record<string, JobPublishState> = {};
      for (const job of jobs) {
        next[job.id] = prev[job.id] ?? { copy: buildDefaultCopy(job), status: "idle" };
      }
      return next;
    });
  }, [jobs]);
  const [publishing, setPublishing] = useState(false);
  const [preflight, setPreflight] = useState<Preflight | null>(null);
  const [destinationMode, setDestinationMode] = useState<"existing" | "new">("existing");
  const [campaigns, setCampaigns] = useState<MetaCampaignLive[]>([]);
  const [audiences, setAudiences] = useState<MetaAudience[]>([]);
  const [newAdSetForm, setNewAdSetForm] = useState<NewAdSetFormState>(DEFAULT_NEW_AD_SET);

  useEffect(() => {
    async function loadData() {
      try {
        const [adSetsRes, campaignsRes, audiencesRes] = await Promise.all([
          fetch("/api/pdp/publish?action=adsets&brand=winespies"),
          fetch("/api/pdp/publish?action=campaigns&brand=winespies"),
          fetch("/api/pdp/publish?action=audiences&brand=winespies"),
        ]);

        if (adSetsRes.ok) {
          const data = (await adSetsRes.json()) as { adSets: AdSet[] };
          setAdSets(data.adSets ?? []);
          if (data.adSets?.length > 0) setSelectedAdSetId(data.adSets[0].id);
        } else {
          setAdSetsError(`HTTP ${adSetsRes.status}`);
        }

        if (campaignsRes.ok) {
          const data = (await campaignsRes.json()) as {
            campaigns: MetaCampaignLive[];
          };
          setCampaigns(data.campaigns ?? []);
        }

        if (audiencesRes.ok) {
          const data = (await audiencesRes.json()) as {
            audiences: MetaAudience[];
          };
          setAudiences(data.audiences ?? []);
        }
      } catch (err) {
        setAdSetsError(
          err instanceof Error ? err.message : "Failed to load data",
        );
      } finally {
        setAdSetsLoading(false);
      }
    }
    loadData();
  }, []);

  useEffect(() => {
    async function checkPreflight() {
      try {
        const res = await fetch(
          "/api/pdp/publish?action=preflight&brand=winespies",
        );
        if (!res.ok) return;
        const data = (await res.json()) as Preflight;
        setPreflight(data);
      } catch {
        // silent — publish attempt will surface the real error
      }
    }
    checkPreflight();
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

  async function handleRetry(jobId: string) {
    const job = jobs.find((j) => j.id === jobId);
    if (!job?.imageBase64) return;

    setJobStates((prev) => ({
      ...prev,
      [jobId]: { ...prev[jobId], status: "publishing", error: undefined },
    }));

    try {
      const res = await fetch("/api/pdp/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: "winespies",
          adSetId: selectedAdSetId || null,
          jobs: [
            {
              jobId: job.id,
              imageBase64: job.imageBase64,
              mimeType: job.mimeType,
              wineName: job.wineName,
              ...jobStates[jobId].copy,
              saleUrl: `https://winespies.com/sales/${job.saleId}`,
            },
          ],
        }),
      });
      const data = (await res.json()) as {
        results: Array<{
          jobId: string;
          success: boolean;
          adId?: string;
          error?: string;
        }>;
        error?: string;
      };
      const r = data.results?.[0];
      if (r) {
        setJobStates((prev) => ({
          ...prev,
          [jobId]: {
            ...prev[jobId],
            status: r.success ? "done" : "error",
            metaAdId: r.adId,
            error: r.error,
          },
        }));
      } else if (data.error) {
        setJobStates((prev) => ({
          ...prev,
          [jobId]: { ...prev[jobId], status: "error", error: data.error },
        }));
      }
    } catch (err) {
      setJobStates((prev) => ({
        ...prev,
        [jobId]: {
          ...prev[jobId],
          status: "error",
          error: err instanceof Error ? err.message : "Retry failed",
        },
      }));
    }
  }

  function buildNewAdSetInput(): NewAdSetInput {
    return {
      campaignId: newAdSetForm.campaignId,
      name: newAdSetForm.name,
      budgetType: newAdSetForm.budgetType,
      budgetCents: Math.round(parseFloat(newAdSetForm.budgetAmount || "0") * 100),
      startTime: new Date(newAdSetForm.startDate).toISOString(),
      endTime: newAdSetForm.endDate
        ? new Date(newAdSetForm.endDate).toISOString()
        : undefined,
      optimizationGoal: newAdSetForm.optimizationGoal,
      bidStrategy: newAdSetForm.bidStrategy,
      bidAmountCents: newAdSetForm.bidAmount
        ? Math.round(parseFloat(newAdSetForm.bidAmount) * 100)
        : undefined,
      targeting: {
        geoCountries: newAdSetForm.geoCountries,
        ageMin: parseInt(newAdSetForm.ageMin, 10),
        ageMax: parseInt(newAdSetForm.ageMax, 10),
        genders:
          newAdSetForm.gender === "all"
            ? undefined
            : [newAdSetForm.gender === "male" ? 1 : 2],
        customAudiences: newAdSetForm.selectedAudiences.map(({ id, name }) => ({
          id,
          name,
        })),
      },
      placementMode: newAdSetForm.placementMode,
      publisherPlatforms: newAdSetForm.publisherPlatforms,
      facebookPositions: newAdSetForm.facebookPositions,
      instagramPositions: newAdSetForm.instagramPositions,
    };
  }

  async function handlePublish() {
    if (!selectedAdSetId && destinationMode === "existing") return;
    if (destinationMode === "new" && (!newAdSetForm.campaignId || !newAdSetForm.name || !newAdSetForm.budgetAmount)) {
      return;
    }

    setPublishing(true);

    const publishJobs = jobs
      .filter((job): job is typeof job & { imageBase64: string } => !!job.imageBase64)
      .map((job) => ({
        jobId: job.id,
        imageBase64: job.imageBase64,
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
          adSetId: destinationMode === "existing" ? selectedAdSetId : null,
          newAdSet: destinationMode === "new" ? buildNewAdSetInput() : undefined,
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
      {preflight && !preflight.ok && (
        <div className="rounded-xl border border-danger/30 bg-danger/5 p-4 text-sm text-danger">
          <p className="font-semibold mb-1">Meta configuration missing</p>
          <p className="text-xs">
            Set the following environment variables to enable publishing:{" "}
            <code className="font-mono bg-danger/10 px-1 rounded">
              {preflight.missing.join(", ")}
            </code>
          </p>
        </div>
      )}
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

      <div className="border border-border rounded-xl p-4 flex flex-col gap-4 bg-surface">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-foreground">
            Destination Ad Set
          </div>
          <div className="flex gap-1">
            {(["existing", "new"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setDestinationMode(m)}
                className={`px-3 py-1 text-xs rounded-lg border transition-colors ${
                  destinationMode === m
                    ? "border-accent bg-accent/10 text-accent font-medium"
                    : "border-border text-muted hover:text-foreground"
                }`}
              >
                {m === "existing" ? "Use existing" : "Create new"}
              </button>
            ))}
          </div>
        </div>

        {destinationMode === "existing" && (
          <>
            {adSetsLoading ? (
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
            )}
          </>
        )}

        {destinationMode === "new" && (
          <NewAdSetForm
            campaigns={campaigns}
            audiences={audiences}
            value={newAdSetForm}
            onChange={(updates) =>
              setNewAdSetForm((prev) => ({ ...prev, ...updates }))
            }
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
                  {state.status === "idle" && (
                    <span className="text-xs text-muted">Ready</span>
                  )}
                  {state.status === "publishing" && (
                    <span className="text-xs text-accent animate-pulse">
                      Publishing…
                    </span>
                  )}
                  {state.status === "done" && (
                    <span className="text-xs text-success font-medium">
                      ✅ Published
                    </span>
                  )}
                  {state.status === "error" && (
                    <button
                      onClick={() => handleRetry(job.id)}
                      className="text-xs text-accent underline hover:no-underline"
                    >
                      Retry
                    </button>
                  )}
                </div>
              </div>
              {state.status === "error" && state.error && (
                <div className="px-4 pb-3">
                  <p className="text-xs text-danger bg-danger/5 border border-danger/20 rounded-lg px-3 py-2">
                    {state.error}
                  </p>
                </div>
              )}
            </div>
          );
        })}
      </div>

      {!allDone && (
        <div className="flex justify-end">
          <button
            onClick={handlePublish}
            disabled={
            publishing ||
            anyPublishing ||
            preflight?.ok === false ||
            (destinationMode === "existing" && !selectedAdSetId) ||
            (destinationMode === "new" &&
              (!newAdSetForm.campaignId ||
                !newAdSetForm.name ||
                !newAdSetForm.budgetAmount))
          }
            className="px-6 py-2.5 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {publishing
              ? destinationMode === "new"
                ? "Creating ad set…"
                : "Publishing…"
              : destinationMode === "new"
              ? `Create Ad Set & Publish ${jobs.length} Ad${jobs.length !== 1 ? "s" : ""}`
              : `Publish ${jobs.length} Ad${jobs.length !== 1 ? "s" : ""} to Meta`}
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
