"use client";

import Link from "next/link";
import ScoreRing from "./ScoreRing";

interface PublishPanelProps {
  status: "draft" | "published";
  score: number | null;
  lastSaved: string | null;
  content: string;
  onPublish: () => void;
  onUnpublish: () => void;
  publishing: boolean;
}

export default function PublishPanel({
  status,
  score,
  lastSaved,
  content,
  onPublish,
  onUnpublish,
  publishing,
}: PublishPanelProps) {
  return (
    <div className="space-y-6">
      {/* Status badge */}
      <div className="flex items-center gap-3">
        <span className={`px-3 py-1 text-xs font-bold uppercase rounded-full ${
          status === "published"
            ? "bg-green-100 text-green-700"
            : "bg-gray-100 text-gray-600"
        }`}>
          {status}
        </span>
        {lastSaved && (
          <span className="text-xs text-muted">
            Last saved {new Date(lastSaved).toLocaleString()}
          </span>
        )}
      </div>

      {/* Score */}
      {score !== null && (
        <div className="flex justify-center py-4">
          <ScoreRing score={score} size={140} />
        </div>
      )}

      {/* Actions */}
      <div className="space-y-3">
        {status === "draft" ? (
          <button
            onClick={onPublish}
            disabled={publishing || !content.trim()}
            className="w-full px-4 py-3 text-sm font-medium bg-green-600 text-white rounded-lg hover:bg-green-700 disabled:opacity-40 transition-colors"
          >
            {publishing ? "Publishing..." : "Publish"}
          </button>
        ) : (
          <button
            onClick={onUnpublish}
            disabled={publishing}
            className="w-full px-4 py-3 text-sm font-medium border border-border rounded-lg text-muted hover:border-accent hover:text-accent disabled:opacity-40 transition-colors"
          >
            {publishing ? "Updating..." : "Unpublish (back to draft)"}
          </button>
        )}

        <button
          onClick={() => navigator.clipboard.writeText(content)}
          disabled={!content.trim()}
          className="w-full px-4 py-2.5 text-sm font-medium border border-border rounded-lg hover:border-accent hover:text-accent disabled:opacity-40 transition-colors"
        >
          Copy to Clipboard
        </button>

        <Link
          href="/copywriting/library"
          className="block w-full px-4 py-2.5 text-sm font-medium text-center border border-border rounded-lg hover:border-accent hover:text-accent transition-colors"
        >
          View Library
        </Link>
      </div>
    </div>
  );
}
