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

  // Adset mode: shared (all wines → one adset) vs per-wine (one adset per wine)
  const [adsetMode, setAdsetMode] = useState<"shared" | "per-wine">("shared");

  // Per-wine adset defaults form
  const [perWineDefaults, setPerWineDefaults] = useState({
    campaignId: "",
    budgetAmount: "",
    bidStrategy: "LOWEST_COST_WITHOUT_CAP" as
      | "LOWEST_COST_WITHOUT_CAP"
      | "COST_CAP"
      | "BID_CAP",
    bidAmount: "",
  });

  // AI copy generation
  const [generatingCopy, setGeneratingCopy] = useState(false);
  const [copyGenError, setCopyGenError] = useState<string | null>(null);

  // Per-wine copy regeneration
  const [regeneratingJobs, setRegeneratingJobs] = useState<Set<string>>(new Set());
  const [regenerateErrors, setRegenerateErrors] = useState<Record<string, string>>({});

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

  async function generateCopy() {
    setGeneratingCopy(true);
    setCopyGenError(null);
    try {
      const wines = jobs.map((job) => ({
        saleId: job.saleId,
        wineName: job.wineName,
      }));
      const res = await fetch("/api/pdp/generate-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand: "winespies", wines }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        copies: Array<{
          saleId: number;
          headline: string;
          primaryText: string;
          description: string;
        }>;
      };
      setJobStates((prev) => {
        const next = { ...prev };
        for (const copy of data.copies) {
          const jobId = jobs.find((j) => j.saleId === copy.saleId)?.id;
          if (jobId && next[jobId]) {
            next[jobId] = {
              ...next[jobId],
              copy: {
                headline: copy.headline,
                primary_text: copy.primaryText,
                description: copy.description,
              },
            };
          }
        }
        return next;
      });
    } catch (err) {
      setCopyGenError(
        err instanceof Error ? err.message : "Copy generation failed",
      );
    } finally {
      setGeneratingCopy(false);
    }
  }

  async function regenerateCopyForJob(jobId: string) {
    const job = jobs.find((j) => j.id === jobId);
    if (!job) return;
    setRegeneratingJobs((prev) => new Set(prev).add(jobId));
    setRegenerateErrors((prev) => {
      const next = { ...prev };
      delete next[jobId];
      return next;
    });
    try {
      const res = await fetch("/api/pdp/generate-copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: "winespies",
          wines: [{ saleId: job.saleId, wineName: job.wineName }],
        }),
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = (await res.json()) as {
        copies: Array<{
          saleId: number;
          headline: string;
          primaryText: string;
          description: string;
        }>;
      };
      const copy = data.copies[0];
      if (copy) {
        setJobStates((prev) => ({
          ...prev,
          [jobId]: {
            ...prev[jobId],
            copy: {
              headline: copy.headline,
              primary_text: copy.primaryText,
              description: copy.description,
            },
          },
        }));
      }
    } catch (err) {
      setRegenerateErrors((prev) => ({
        ...prev,
        [jobId]: err instanceof Error ? err.message : "Copy generation failed",
      }));
    } finally {
      setRegeneratingJobs((prev) => {
        const next = new Set(prev);
        next.delete(jobId);
        return next;
      });
    }
  }

  async function handleRetry(jobId: string) {
    const job = jobs.find((j) => j.id === jobId);
    if (!job?.imageBase64) return;

    setJobStates((prev) => ({
      ...prev,
      [jobId]: { ...prev[jobId], status: "publishing", error: undefined },
    }));

    try {
      const body: Record<string, unknown> = {
        brand: "winespies",
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
      };

      if (adsetMode === "per-wine") {
        body.perWineAdSetDefaults = {
          campaignId: perWineDefaults.campaignId,
          budgetCents: Math.round(parseFloat(perWineDefaults.budgetAmount || "0") * 100),
          bidStrategy: perWineDefaults.bidStrategy,
          ...(perWineDefaults.bidAmount
            ? { bidAmountCents: Math.round(parseFloat(perWineDefaults.bidAmount) * 100) }
            : {}),
        };
        body.adSetId = null;
      } else {
        body.adSetId = destinationMode === "existing" ? selectedAdSetId : null;
        body.newAdSet = destinationMode === "new" ? buildNewAdSetInput() : undefined;
      }

      const res = await fetch("/api/pdp/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
    if (adsetMode === "shared") {
      if (!selectedAdSetId && destinationMode === "existing") return;
      if (destinationMode === "new" && (!newAdSetForm.campaignId || !newAdSetForm.name || !newAdSetForm.budgetAmount)) {
        return;
      }
    }
    if (adsetMode === "per-wine" && (!perWineDefaults.campaignId || !perWineDefaults.budgetAmount)) {
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
      const body: Record<string, unknown> = {
        brand: "winespies",
        jobs: publishJobs,
      };

      if (adsetMode === "per-wine") {
        body.perWineAdSetDefaults = {
          campaignId: perWineDefaults.campaignId,
          budgetCents: Math.round(parseFloat(perWineDefaults.budgetAmount || "0") * 100),
          bidStrategy: perWineDefaults.bidStrategy,
          ...(perWineDefaults.bidAmount
            ? { bidAmountCents: Math.round(parseFloat(perWineDefaults.bidAmount) * 100) }
            : {}),
        };
        body.adSetId = null;
      } else {
        body.adSetId = destinationMode === "existing" ? selectedAdSetId : null;
        body.newAdSet = destinationMode === "new" ? buildNewAdSetInput() : undefined;
      }

      const res = await fetch("/api/pdp/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
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
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={generateCopy}
            disabled={generatingCopy || publishing}
            className="px-3 py-2 bg-surface border border-border text-foreground text-sm font-medium rounded-lg hover:bg-background transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generatingCopy ? "Generating…" : "✦ Generate Copy"}
          </button>
          <button
            onClick={onBack}
            className="px-3 py-2 text-sm text-muted hover:text-foreground transition-colors"
          >
            ← Back
          </button>
        </div>
      </div>

      {copyGenError && (
        <div className="px-3 py-2 bg-danger/10 text-danger text-xs rounded-lg">
          {copyGenError}
        </div>
      )}

      <div className="border border-border rounded-xl p-4 flex flex-col gap-4 bg-surface">
        <div className="flex items-center justify-between">
          <div className="text-sm font-medium text-foreground">Ad Set</div>
          <div className="flex gap-1">
            {(["shared", "per-wine"] as const).map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setAdsetMode(m)}
                className={`px-3 py-1 text-xs rounded-lg border transition-colors ${
                  adsetMode === m
                    ? "border-accent bg-accent/10 text-accent font-medium"
                    : "border-border text-muted hover:text-foreground"
                }`}
              >
                {m === "shared" ? "All in one adset" : "One adset per wine"}
              </button>
            ))}
          </div>
        </div>

        {adsetMode === "shared" && (
          <>
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
          </>
        )}

        {adsetMode === "per-wine" && (
          <div className="flex flex-col gap-3">
            <p className="text-xs text-muted">
              One adset will be created per wine, named after the wine. All under the selected campaign.
            </p>
            <div>
              <label className="block text-xs font-medium text-muted mb-1">Campaign</label>
              <select
                value={perWineDefaults.campaignId}
                onChange={(e) =>
                  setPerWineDefaults((prev) => ({ ...prev, campaignId: e.target.value }))
                }
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-accent"
              >
                <option value="">Select campaign…</option>
                {campaigns.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Daily Budget ($)</label>
                <input
                  type="number"
                  min="1"
                  step="0.01"
                  value={perWineDefaults.budgetAmount}
                  onChange={(e) =>
                    setPerWineDefaults((prev) => ({ ...prev, budgetAmount: e.target.value }))
                  }
                  placeholder="50"
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-muted mb-1">Bid Strategy</label>
                <select
                  value={perWineDefaults.bidStrategy}
                  onChange={(e) =>
                    setPerWineDefaults((prev) => ({
                      ...prev,
                      bidStrategy: e.target.value as typeof perWineDefaults.bidStrategy,
                    }))
                  }
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-accent"
                >
                  <option value="LOWEST_COST_WITHOUT_CAP">Lowest cost</option>
                  <option value="COST_CAP">Cost cap</option>
                  <option value="BID_CAP">Bid cap</option>
                </select>
              </div>
            </div>
            {perWineDefaults.bidStrategy !== "LOWEST_COST_WITHOUT_CAP" && (
              <div>
                <label className="block text-xs font-medium text-muted mb-1">
                  {perWineDefaults.bidStrategy === "COST_CAP" ? "Cost cap ($)" : "Bid cap ($)"}
                </label>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={perWineDefaults.bidAmount}
                  onChange={(e) =>
                    setPerWineDefaults((prev) => ({ ...prev, bidAmount: e.target.value }))
                  }
                  placeholder="25.00"
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-accent"
                />
              </div>
            )}
          </div>
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
                  <div className="flex items-center gap-2">
                    <div className="text-xs text-muted">{job.styleName}</div>
                    {state.status !== "done" && (
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => regenerateCopyForJob(job.id)}
                          disabled={regeneratingJobs.has(job.id)}
                          title="Regenerate copy for this wine"
                          className="text-[10px] text-accent hover:underline disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                          {regeneratingJobs.has(job.id) ? "…" : "↺ Copy"}
                        </button>
                        {regenerateErrors[job.id] && (
                          <span className="text-[10px] text-danger" title={regenerateErrors[job.id]}>
                            ✕
                          </span>
                        )}
                      </div>
                    )}
                  </div>
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
              (adsetMode === "shared" && destinationMode === "existing" && !selectedAdSetId) ||
              (adsetMode === "shared" && destinationMode === "new" &&
                (!newAdSetForm.campaignId ||
                  !newAdSetForm.name ||
                  !newAdSetForm.budgetAmount)) ||
              (adsetMode === "per-wine" && (!perWineDefaults.campaignId || !perWineDefaults.budgetAmount))
            }
            className="px-6 py-2.5 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {publishing
              ? adsetMode === "per-wine"
                ? "Creating adsets & publishing…"
                : "Publishing…"
              : adsetMode === "per-wine"
              ? `Create ${jobs.length} Adset${jobs.length !== 1 ? "s" : ""} & Publish`
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
