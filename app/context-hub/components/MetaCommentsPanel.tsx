"use client";

import { useCallback, useEffect, useState } from "react";

const BRAND_ID = "winespies";

export default function MetaCommentsPanel() {
  const [metaStatus, setMetaStatus] = useState<{
    syncedAt: string | null;
    postCount: number;
    commentCount: number;
  } | null>(null);
  const [metaThemes, setMetaThemes] = useState<{
    generatedAt: string | null;
    summary: string;
  } | null>(null);
  const [metaBusy, setMetaBusy] = useState(false);

  const fetchMeta = useCallback(() => {
    fetch(`/api/meta-comments?brand=${BRAND_ID}`)
      .then((r) => r.json())
      .then((d) => setMetaStatus(d))
      .catch(() => setMetaStatus(null));

    fetch(`/api/meta-comment-themes?brand=${BRAND_ID}`)
      .then((r) => r.json())
      .then((d) => setMetaThemes(d))
      .catch(() => setMetaThemes(null));
  }, []);

  useEffect(() => {
    fetchMeta();
  }, [fetchMeta]);

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Meta Ad Comments</h2>

      <div className="rounded-lg border border-border bg-surface p-5">
        <div className="flex items-start justify-between gap-4">
          <p className="text-sm text-muted">
            Sync comments from the posts your active Meta ads promote (not from your page feed). Then generate themes for briefs.
          </p>
          <div className="text-right shrink-0">
            <div className="text-xs text-muted">
              {metaStatus?.syncedAt
                ? `Last sync: ${new Date(metaStatus.syncedAt).toLocaleString()}`
                : "Not synced yet"}
            </div>
            <div className="text-xs text-muted">
              {metaStatus
                ? `${metaStatus.commentCount} comments from ${metaStatus.postCount} ad-backed posts`
                : ""}
            </div>
          </div>
        </div>

        <div className="grid gap-3 mt-4 sm:grid-cols-2">
          <div className="flex items-end gap-2 flex-wrap">
            <button
              onClick={async () => {
                setMetaBusy(true);
                try {
                  await fetch("/api/meta-comments/sync", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ brand: BRAND_ID }),
                  });
                  fetchMeta();
                } finally {
                  setMetaBusy(false);
                }
              }}
              disabled={metaBusy}
              className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
            >
              Sync comments from ads
            </button>
            <button
              onClick={async () => {
                setMetaBusy(true);
                try {
                  await fetch("/api/meta-comment-themes", {
                    method: "POST",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({ brand: BRAND_ID }),
                  });
                  fetchMeta();
                } finally {
                  setMetaBusy(false);
                }
              }}
              disabled={metaBusy}
              className="px-4 py-2 text-sm font-medium border border-border rounded-lg hover:bg-background transition-colors disabled:opacity-50"
            >
              Generate themes
            </button>
          </div>

          <div className="text-xs text-muted flex items-end justify-end">
            {metaThemes?.generatedAt
              ? `Themes updated: ${new Date(metaThemes.generatedAt).toLocaleString()}`
              : "No themes yet"}
          </div>
        </div>

        {metaThemes?.summary ? (
          <div className="mt-4 rounded-lg border border-border bg-background p-4">
            <div className="text-xs text-muted mb-2">Latest summary</div>
            <div className="text-sm text-muted whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
              {metaThemes.summary}
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
