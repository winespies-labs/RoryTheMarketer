"use client";

import type { GenerationJob } from "../hooks/useGenerator";

function downloadImage(job: GenerationJob) {
  if (!job.imageBase64) return;
  const ext = job.mimeType.includes("png") ? "png" : job.mimeType.includes("webp") ? "webp" : "jpg";
  const slug = (s: string) => s.replace(/[^a-z0-9]/gi, "-").toLowerCase();
  const a = document.createElement("a");
  a.href = `data:${job.mimeType};base64,${job.imageBase64}`;
  a.download = `${slug(job.wineName)}_${slug(job.styleName)}.${ext}`;
  a.click();
}

function StatusPill({ status, error }: { status: GenerationJob["status"]; error?: string }) {
  if (status === "pending")
    return <span className="text-[10px] text-muted">Queued</span>;
  if (status === "generating")
    return <span className="text-[10px] text-accent font-medium animate-pulse">Generating…</span>;
  if (status === "complete")
    return <span className="text-[10px] text-success font-medium">Done</span>;
  if (status === "error")
    return (
      <span className="text-[10px] text-danger font-medium" title={error}>
        Failed
      </span>
    );
  return null;
}

function JobCard({
  job,
  onRegenerate,
}: {
  job: GenerationJob;
  onRegenerate: () => void;
}) {
  return (
    <div className="border border-border rounded-xl overflow-hidden bg-surface flex flex-col">
      {/* Image area */}
      <div className="aspect-square bg-background relative flex items-center justify-center">
        {job.imageBase64 ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={`data:${job.mimeType};base64,${job.imageBase64}`}
            alt={`${job.wineName} — ${job.styleName}`}
            className="w-full h-full object-contain"
          />
        ) : job.status === "generating" ? (
          <div className="flex flex-col items-center gap-3">
            <div className="w-8 h-8 border-2 border-accent border-t-transparent rounded-full animate-spin" />
            <span className="text-xs text-muted">Generating…</span>
          </div>
        ) : job.status === "error" ? (
          <div className="text-center px-4">
            <div className="text-sm text-danger font-medium mb-1">Generation failed</div>
            <div className="text-xs text-muted">{job.error}</div>
          </div>
        ) : (
          <div className="w-10 h-10 rounded-full border-2 border-border/40" />
        )}
      </div>

      {/* Footer */}
      <div className="px-3 py-2.5 flex items-center justify-between gap-2 border-t border-border/40">
        <div className="min-w-0">
          <div className="text-xs font-semibold text-foreground truncate">{job.wineName}</div>
          <div className="flex items-center gap-1">
            <span className="text-[10px] text-muted truncate">{job.styleName}</span>
            <span className="text-muted/30">·</span>
            <StatusPill status={job.status} error={job.error} />
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          {job.status === "error" && (
            <button
              onClick={onRegenerate}
              className="text-[11px] text-accent hover:underline"
            >
              Retry
            </button>
          )}
          {job.imageBase64 && (
            <button
              onClick={() => downloadImage(job)}
              title="Download"
              className="w-7 h-7 flex items-center justify-center rounded-lg bg-accent/10 text-accent hover:bg-accent/20 transition-colors"
            >
              <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
              </svg>
            </button>
          )}
        </div>
      </div>
    </div>
  );
}

interface ResultsGridProps {
  jobs: GenerationJob[];
  running: boolean;
  progress: { total: number; complete: number; error: number; generating: number };
  onRegenerate: (id: string) => void;
  onBack: () => void;
  onPublish: () => void;
}

export default function ResultsGrid({
  jobs,
  running,
  progress,
  onRegenerate,
  onBack,
  onPublish,
}: ResultsGridProps) {
  const completedJobs = jobs.filter((j) => j.imageBase64);

  const downloadAll = () => completedJobs.forEach((j) => downloadImage(j));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold">Generated Ads</h2>
          <p className="text-sm text-muted mt-0.5">
            {running
              ? `${progress.complete} of ${progress.total} complete${progress.error > 0 ? ` · ${progress.error} failed` : ""}`
              : progress.total > 0
              ? `${progress.complete} generated${progress.error > 0 ? ` · ${progress.error} failed` : ""}`
              : "Ready to generate"}
          </p>
        </div>
        <div className="flex items-center gap-3">
          <button
            onClick={onBack}
            className="px-3 py-2 text-sm text-muted hover:text-foreground transition-colors"
          >
            ← Back
          </button>
          {completedJobs.length > 0 && (
            <button
              onClick={downloadAll}
              className="px-4 py-2 bg-surface border border-border text-foreground text-sm font-medium rounded-lg hover:bg-background transition-colors"
            >
              Download All ({completedJobs.length})
            </button>
          )}
          {completedJobs.length > 0 && !running && (
            <button
              onClick={onPublish}
              className="px-4 py-2 bg-accent text-white text-sm font-medium rounded-lg hover:bg-accent/90 transition-colors"
            >
              Publish to Meta ({completedJobs.length}) →
            </button>
          )}
        </div>
      </div>

      {/* Progress bar */}
      {running && progress.total > 0 && (
        <div className="w-full bg-border/40 rounded-full h-1">
          <div
            className="bg-accent h-1 rounded-full transition-all duration-500"
            style={{ width: `${(progress.complete / progress.total) * 100}%` }}
          />
        </div>
      )}

      {jobs.length === 0 ? (
        <div className="text-center py-16 text-muted text-sm">No ads queued yet.</div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
          {jobs.map((job) => (
            <JobCard
              key={job.id}
              job={job}
              onRegenerate={() => onRegenerate(job.id)}
            />
          ))}
        </div>
      )}
    </div>
  );
}
