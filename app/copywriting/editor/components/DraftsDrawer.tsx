"use client";

interface Writeup {
  id: string;
  title: string;
  content: string;
  status: "draft" | "published";
  score: number | null;
  createdAt: string;
  updatedAt: string;
}

interface DraftsDrawerProps {
  writeups: Writeup[];
  activeWriteupId: string | null;
  open: boolean;
  onToggle: () => void;
  onLoad: (writeup: Writeup) => void;
  onDelete: (id: string) => void;
  onNew: () => void;
}

export default function DraftsDrawer({
  writeups,
  activeWriteupId,
  open,
  onToggle,
  onLoad,
  onDelete,
  onNew,
}: DraftsDrawerProps) {
  const sorted = [...writeups].sort(
    (a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
  );

  return (
    <div className="border-t border-border">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between px-4 py-3 text-sm font-medium hover:bg-surface/50 transition-colors"
      >
        <span>Drafts ({writeups.length})</span>
        <svg
          className={`w-4 h-4 text-muted transition-transform ${open ? "rotate-180" : ""}`}
          fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M5 15l7-7 7 7" />
        </svg>
      </button>

      {open && (
        <div className="px-4 pb-4 space-y-2">
          <button
            onClick={onNew}
            className="w-full px-3 py-2 text-sm border border-dashed border-border rounded-lg text-muted hover:border-accent hover:text-accent transition-colors"
          >
            + New Draft
          </button>

          {sorted.length === 0 && (
            <p className="text-sm text-muted py-2">No drafts yet.</p>
          )}

          {sorted.map((w) => (
            <div
              key={w.id}
              className={`flex items-center justify-between p-3 rounded-lg border transition-colors cursor-pointer ${
                activeWriteupId === w.id
                  ? "border-accent bg-accent-light/30"
                  : "border-border hover:border-accent/50"
              }`}
              onClick={() => onLoad(w)}
            >
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium truncate">{w.title}</span>
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-medium ${
                    w.status === "published"
                      ? "bg-green-100 text-green-700"
                      : "bg-gray-100 text-gray-500"
                  }`}>
                    {w.status}
                  </span>
                  {w.score !== null && (
                    <span className="text-[10px] text-muted">{w.score}/100</span>
                  )}
                </div>
                <div className="text-xs text-muted mt-0.5">
                  {new Date(w.updatedAt).toLocaleDateString()}
                </div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(w.id); }}
                className="text-xs text-muted hover:text-danger ml-3 shrink-0"
              >
                Delete
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
