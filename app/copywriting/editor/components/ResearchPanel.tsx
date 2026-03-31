"use client";

import { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

interface WineDetails {
  wineName: string;
  varietal: string;
  region: string;
  points: string;
  priceDiscount: string;
  tastingNotes: string;
  scarcityAngle: string;
}

interface ResearchPanelProps {
  wineDetails: WineDetails;
  onWineDetailsChange: (details: WineDetails) => void;
  onInsertContent: (text: string) => void;
  title: string;
}

const BRAND = "winespies";

export default function ResearchPanel({
  wineDetails,
  onWineDetailsChange,
  onInsertContent,
  title,
}: ResearchPanelProps) {
  const [researchResult, setResearchResult] = useState<string | null>(null);
  const [researchLoading, setResearchLoading] = useState(false);
  const [researchError, setResearchError] = useState<string | null>(null);
  const [draftLoading, setDraftLoading] = useState(false);
  const [draftError, setDraftError] = useState<string | null>(null);

  const update = (field: keyof WineDetails, value: string) => {
    onWineDetailsChange({ ...wineDetails, [field]: value });
  };

  const wineName = wineDetails.wineName || title;

  const runResearch = async () => {
    if (!wineName.trim()) return;
    setResearchLoading(true);
    setResearchError(null);
    try {
      const res = await fetch("/api/writeups/research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ wineName: wineName.trim() }),
      });
      if (res.ok) {
        const data = await res.json();
        setResearchResult(data.research);
      } else {
        const data = await res.json().catch(() => ({}));
        setResearchError(data.error || `Request failed (${res.status})`);
      }
    } catch (err) {
      setResearchError(err instanceof Error ? err.message : "Network error");
    }
    setResearchLoading(false);
  };

  const generateDraft = async () => {
    if (!wineName.trim()) return;
    setDraftLoading(true);
    setDraftError(null);
    try {
      const body: Record<string, unknown> = {
        brand: BRAND,
        copyType: "Wine write up",
        wineWriteUp: {
          wineName: wineName.trim() || undefined,
          varietal: wineDetails.varietal.trim() || undefined,
          region: wineDetails.region.trim() || undefined,
          points: wineDetails.points.trim() || undefined,
          priceDiscount: wineDetails.priceDiscount.trim() || undefined,
          tastingNotes: wineDetails.tastingNotes.trim() || undefined,
          scarcityAngle: wineDetails.scarcityAngle.trim() || undefined,
        },
      };
      const res = await fetch("/api/copywriter", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (res.ok) {
        const data = await res.json();
        onInsertContent(data.copy);
      } else {
        const data = await res.json().catch(() => ({}));
        setDraftError(data.error || `Request failed (${res.status})`);
      }
    } catch (err) {
      setDraftError(err instanceof Error ? err.message : "Network error");
    }
    setDraftLoading(false);
  };

  return (
    <div className="space-y-4">
      {/* Wine detail fields */}
      <div className="space-y-3 rounded-lg border border-border bg-background/50 p-4">
        <p className="text-xs font-medium text-muted">Wine details for research & draft generation</p>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Wine name</label>
          <input
            type="text"
            value={wineDetails.wineName}
            onChange={(e) => update("wineName", e.target.value)}
            placeholder={title || "e.g. 2019 Smith Vineyard Cabernet"}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
          />
        </div>
        <div className="grid gap-3 grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Varietal</label>
            <input type="text" value={wineDetails.varietal} onChange={(e) => update("varietal", e.target.value)} placeholder="e.g. Cabernet Sauvignon" className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Region</label>
            <input type="text" value={wineDetails.region} onChange={(e) => update("region", e.target.value)} placeholder="e.g. Napa Valley" className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background" />
          </div>
        </div>
        <div className="grid gap-3 grid-cols-2">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Points / rating</label>
            <input type="text" value={wineDetails.points} onChange={(e) => update("points", e.target.value)} placeholder="e.g. 96 pts" className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background" />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Price / discount</label>
            <input type="text" value={wineDetails.priceDiscount} onChange={(e) => update("priceDiscount", e.target.value)} placeholder="e.g. 60% off" className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background" />
          </div>
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Tasting notes</label>
          <textarea value={wineDetails.tastingNotes} onChange={(e) => update("tastingNotes", e.target.value)} rows={2} placeholder="e.g. Black cherry, tobacco, structured tannins" className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background resize-y" />
        </div>
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Scarcity angle</label>
          <input type="text" value={wineDetails.scarcityAngle} onChange={(e) => update("scarcityAngle", e.target.value)} placeholder="e.g. Two barrels to the US" className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background" />
        </div>
      </div>

      {/* Action buttons */}
      <div className="flex gap-2">
        <button
          onClick={runResearch}
          disabled={!wineName.trim() || researchLoading}
          className="flex-1 px-4 py-2.5 text-sm font-medium border border-border rounded-lg hover:border-accent hover:text-accent disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {researchLoading ? "Researching..." : "Research"}
        </button>
        <button
          onClick={generateDraft}
          disabled={!wineName.trim() || draftLoading}
          className="flex-1 px-4 py-2.5 text-sm font-medium bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
        >
          {draftLoading ? "Generating..." : "Generate Draft"}
        </button>
      </div>

      {/* Errors */}
      {researchError && (
        <div className="border border-danger/30 rounded-lg bg-red-50 p-3 text-sm text-danger">
          {researchError}
        </div>
      )}
      {draftError && (
        <div className="border border-danger/30 rounded-lg bg-red-50 p-3 text-sm text-danger">
          {draftError}
        </div>
      )}

      {/* Research output */}
      {researchResult && (
        <div className="border border-border rounded-xl bg-surface p-4">
          <div className="prose prose-sm max-w-none prose-headings:text-foreground prose-headings:font-semibold prose-h2:text-base prose-h2:mt-4 prose-h2:mb-2 prose-p:text-foreground/80 prose-p:leading-relaxed prose-strong:text-foreground prose-ul:my-1 prose-li:my-0.5">
            <ReactMarkdown remarkPlugins={[remarkGfm]}>{researchResult}</ReactMarkdown>
          </div>
          <div className="flex gap-2 mt-4 pt-3 border-t border-border">
            <button
              onClick={() => {
                const notes = `--- RESEARCH NOTES ---\n${researchResult}\n--- END RESEARCH ---\n\n`;
                onInsertContent(notes);
              }}
              className="px-3 py-1.5 text-xs bg-accent text-white rounded-lg hover:bg-accent/90 transition-colors"
            >
              Insert as Notes
            </button>
            <button
              onClick={() => navigator.clipboard.writeText(researchResult)}
              className="px-3 py-1.5 text-xs border border-border rounded-lg hover:border-accent transition-colors"
            >
              Copy
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
