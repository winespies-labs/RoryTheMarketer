"use client";

import { useState } from "react";

const BRIEF_TYPES = [
  "Video ad creative",
  "Static ad creative",
  "Email campaign",
  "Landing page",
  "Social post",
  "General",
];

const BRAND_ID = "winespies";

export default function BriefsPage() {
  const [briefType, setBriefType] = useState(BRIEF_TYPES[0]);
  const [persona, setPersona] = useState("");
  const [objective, setObjective] = useState("");
  const [notes, setNotes] = useState("");
  const [result, setResult] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult("");

    try {
      const res = await fetch("/api/brief/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: BRAND_ID,
          briefType,
          persona: persona || undefined,
          objective: objective || undefined,
          notes: notes || undefined,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate");
      setResult(data.brief);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight mb-1">Briefs</h1>
      <p className="text-muted mb-6">Generate ad creative briefs grounded in your brand context.</p>

      <div className="grid gap-6 lg:grid-cols-2">
        {/* Input form */}
        <form
          onSubmit={handleGenerate}
          className="rounded-xl border border-border bg-surface p-6 space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Brief Type</label>
            <select
              value={briefType}
              onChange={(e) => setBriefType(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
            >
              {BRIEF_TYPES.map((t) => (
                <option key={t} value={t}>{t}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">Target Persona (optional)</label>
            <input
              type="text"
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              placeholder="e.g. The Casual Explorer, The Collector..."
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">Objective</label>
            <input
              type="text"
              value={objective}
              onChange={(e) => setObjective(e.target.value)}
              placeholder="e.g. Drive new subscriptions, re-engage lapsed buyers..."
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">Additional Notes</label>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              rows={3}
              placeholder="Any specific angle, promotion, wine details, etc."
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background resize-y"
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2.5 text-sm font-medium bg-accent text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? "Generating..." : "Generate Brief"}
          </button>

          {error && (
            <p className="text-sm text-danger bg-red-50 border border-red-200 rounded-lg p-3">
              {error}
            </p>
          )}
        </form>

        {/* Result */}
        <div className="rounded-xl border border-border bg-surface p-6">
          <h2 className="text-sm font-medium text-muted mb-3">Generated Brief</h2>
          {result ? (
            <div className="text-sm whitespace-pre-wrap leading-relaxed">
              {result}
            </div>
          ) : (
            <p className="text-sm text-muted">
              Fill in the form and click Generate to create a brief using your brand context.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
