"use client";

import { useState, useEffect } from "react";

interface CorpusEmail {
  id: string;
  date: string;
  subject: string;
  wine: string;
  score: string;
  price: string;
}

type InputMode = "paste" | "corpus";

export default function ExtractSwipesPanel({
  onExtracted,
}: {
  onExtracted: () => void;
}) {
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<InputMode>("corpus");
  const [copy, setCopy] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [corpusEmails, setCorpusEmails] = useState<CorpusEmail[]>([]);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [corpusLoading, setCorpusLoading] = useState(false);

  useEffect(() => {
    if (open && corpusEmails.length === 0 && !corpusLoading) {
      setCorpusLoading(true);
      fetch("/api/swipe-analysis/corpus")
        .then((r) => r.json())
        .then((data) => {
          setCorpusEmails(data.emails || []);
          setCorpusLoading(false);
        })
        .catch(() => setCorpusLoading(false));
    }
  }, [open, corpusEmails.length, corpusLoading]);

  const toggleEmail = (id: string) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    if (selectedIds.size === corpusEmails.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(corpusEmails.map((e) => e.id)));
    }
  };

  const runAnalysis = async () => {
    setLoading(true);
    setError(null);
    setResult(null);

    const payload: Record<string, unknown> =
      mode === "corpus"
        ? { corpusEmailIds: Array.from(selectedIds) }
        : { copy: copy.trim() };

    try {
      const res = await fetch("/api/swipe-analysis/run", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (res.ok) {
        setResult(data.entriesAdded);
        onExtracted();
      } else {
        setError(data.error || `Request failed (${res.status})`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Network error");
    }
    setLoading(false);
  };

  const canRun =
    mode === "paste" ? copy.trim().length > 0 : selectedIds.size > 0;

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="px-4 py-2 text-sm font-medium border border-border rounded-lg bg-surface hover:bg-background transition-colors"
      >
        Extract from Copy
      </button>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-5 mb-6">
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-sm font-medium text-foreground">
          Extract Swipes from Copy
        </h2>
        <button
          onClick={() => setOpen(false)}
          className="text-xs text-muted hover:text-foreground"
        >
          Close
        </button>
      </div>
      <p className="text-xs text-muted mb-4">
        Analyze email copy and auto-extract technique swipes into your swipe
        file.
      </p>

      {/* Mode tabs */}
      <div className="flex gap-1 border-b border-border mb-4">
        <button
          onClick={() => setMode("corpus")}
          className={`px-3 py-1.5 text-xs border-b-2 transition-colors ${
            mode === "corpus"
              ? "border-accent text-accent font-medium"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          Email Corpus ({corpusEmails.length})
        </button>
        <button
          onClick={() => setMode("paste")}
          className={`px-3 py-1.5 text-xs border-b-2 transition-colors ${
            mode === "paste"
              ? "border-accent text-accent font-medium"
              : "border-transparent text-muted hover:text-foreground"
          }`}
        >
          Paste Copy
        </button>
      </div>

      {mode === "paste" && (
        <textarea
          value={copy}
          onChange={(e) => setCopy(e.target.value)}
          placeholder="Paste the full email copy here..."
          className="w-full min-h-[200px] px-3 py-2 border border-border rounded-xl bg-background text-sm leading-relaxed resize-y focus:outline-none focus:border-accent transition-colors mb-3"
        />
      )}

      {mode === "corpus" && (
        <>
          {corpusLoading ? (
            <div className="border border-border rounded-xl bg-background p-6 text-center text-sm text-muted mb-3">
              Loading corpus...
            </div>
          ) : corpusEmails.length === 0 ? (
            <div className="border border-border rounded-xl bg-background p-6 text-center text-sm text-muted mb-3">
              No corpus file found.
            </div>
          ) : (
            <div className="mb-3">
              <div className="flex items-center justify-between mb-2">
                <p className="text-xs text-muted">
                  {selectedIds.size} of {corpusEmails.length} selected
                </p>
                <button
                  onClick={selectAll}
                  className="text-xs text-accent hover:text-accent/80"
                >
                  {selectedIds.size === corpusEmails.length
                    ? "Deselect All"
                    : "Select All"}
                </button>
              </div>
              <div className="space-y-1 max-h-[250px] overflow-y-auto border border-border rounded-xl p-2">
                {corpusEmails.map((email) => (
                  <label
                    key={email.id}
                    className={`flex items-start gap-2 p-2 rounded-lg cursor-pointer text-xs transition-colors ${
                      selectedIds.has(email.id)
                        ? "bg-accent-light/40 border border-accent/30"
                        : "hover:bg-surface border border-transparent"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={selectedIds.has(email.id)}
                      onChange={() => toggleEmail(email.id)}
                      className="mt-0.5 accent-accent"
                    />
                    <div className="min-w-0 flex-1">
                      <div className="font-medium truncate">{email.subject}</div>
                      <div className="text-muted/60 mt-0.5">
                        {email.wine} {email.price && `\u00b7 ${email.price}`}
                      </div>
                    </div>
                  </label>
                ))}
              </div>
            </div>
          )}
        </>
      )}

      <button
        onClick={runAnalysis}
        disabled={!canRun || loading}
        className="px-4 py-2 text-sm bg-foreground text-background rounded-lg font-medium hover:bg-foreground/90 disabled:opacity-40 transition-colors"
      >
        {loading ? (
          <span className="flex items-center gap-2">
            <span className="w-3 h-3 border-2 border-background border-t-transparent rounded-full animate-spin" />
            Analyzing...
          </span>
        ) : (
          "Analyze & Extract"
        )}
      </button>

      {error && (
        <div className="mt-3 border border-danger/30 rounded-lg bg-red-50 p-3 text-xs text-danger">
          {error}
        </div>
      )}

      {result && (
        <div className="mt-3 border border-border rounded-lg bg-background p-3">
          <p className="text-xs font-medium text-green-700 mb-2">
            Swipes extracted and saved
          </p>
          <div className="text-xs text-muted whitespace-pre-wrap max-h-[200px] overflow-y-auto">
            {result}
          </div>
        </div>
      )}
    </div>
  );
}
