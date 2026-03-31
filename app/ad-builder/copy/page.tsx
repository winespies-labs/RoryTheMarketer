"use client";

import { useState } from "react";
import Link from "next/link";
import type { AdCopyOutput } from "@/app/api/ad-builder/copy/route";

const BRAND_ID = "winespies";

export default function AdCopyPage() {
  const [offerContext, setOfferContext] = useState("");
  const [persona, setPersona] = useState("");
  const [instructions, setInstructions] = useState("");
  const [includeReviewSnippets, setIncludeReviewSnippets] = useState(true);
  const [result, setResult] = useState<AdCopyOutput | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const handleGenerate = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError("");
    setResult(null);

    try {
      const res = await fetch("/api/ad-builder/copy", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: BRAND_ID,
          offerContext: offerContext.trim() || undefined,
          persona: persona.trim() || undefined,
          instructions: instructions.trim() || undefined,
          includeReviewSnippets,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to generate");
      setResult(data as AdCopyOutput);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
  };

  return (
    <div>
      <div className="flex items-center gap-3 mb-4">
        <Link
          href="/ad-builder"
          className="text-muted hover:text-foreground text-sm"
        >
          ← Ad Builder
        </Link>
      </div>
      <h1 className="text-2xl font-semibold tracking-tight mb-1">
        Ad Copy
      </h1>
      <p className="text-muted mb-6">
        Generate Facebook/Meta ad copy (headlines, primary text, CTAs) using your brand voice, USPs, and customer reviews.
      </p>

      <div className="grid gap-6 lg:grid-cols-2">
        <form
          onSubmit={handleGenerate}
          className="rounded-xl border border-border bg-surface p-6 space-y-4"
        >
          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Offer / campaign focus
            </label>
            <textarea
              value={offerContext}
              onChange={(e) => setOfferContext(e.target.value)}
              rows={3}
              placeholder="e.g. 95-point Napa Cab at 60% off, free shipping over $99, or new member welcome offer"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background resize-y"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Target persona (optional)
            </label>
            <input
              type="text"
              value={persona}
              onChange={(e) => setPersona(e.target.value)}
              placeholder="e.g. The Casual Explorer"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-muted mb-1">
              Additional instructions (optional)
            </label>
            <textarea
              value={instructions}
              onChange={(e) => setInstructions(e.target.value)}
              rows={2}
              placeholder="e.g. Lead with urgency, mention the Locker for free shipping"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background resize-y"
            />
          </div>
          <label className="flex items-center gap-2 text-sm text-muted">
            <input
              type="checkbox"
              checked={includeReviewSnippets}
              onChange={(e) => setIncludeReviewSnippets(e.target.checked)}
              className="rounded border-border"
            />
            Use customer review snippets for proof and language
          </label>
          <button
            type="submit"
            disabled={loading}
            className="w-full px-4 py-2.5 text-sm font-medium bg-accent text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
          >
            {loading ? "Generating…" : "Generate ad copy"}
          </button>
          {error && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">
              {error}
            </p>
          )}
        </form>

        <div className="rounded-xl border border-border bg-surface p-6">
          <h2 className="text-sm font-medium text-muted mb-3">Output</h2>
          {result ? (
            <div className="space-y-4 text-sm">
              {result.headlines?.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-foreground">Headlines</span>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(result.headlines!.join("\n"))
                      }
                      className="text-xs text-muted hover:text-accent"
                    >
                      Copy all
                    </button>
                  </div>
                  <ul className="space-y-1.5 text-foreground">
                    {result.headlines.map((h, i) => (
                      <li
                        key={i}
                        className="flex items-start gap-2 group"
                      >
                        <span className="text-muted shrink-0">{i + 1}.</span>
                        <span className="flex-1">{h}</span>
                        <button
                          type="button"
                          onClick={() => copyToClipboard(h)}
                          className="opacity-0 group-hover:opacity-100 text-muted hover:text-accent shrink-0"
                          title="Copy"
                        >
                          Copy
                        </button>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
              {result.primaryText && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-foreground">
                      Primary text
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(result.primaryText!)}
                      className="text-xs text-muted hover:text-accent"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-foreground whitespace-pre-wrap leading-relaxed">
                    {result.primaryText}
                  </p>
                </div>
              )}
              {result.description && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-foreground">
                      Description
                    </span>
                    <button
                      type="button"
                      onClick={() => copyToClipboard(result.description!)}
                      className="text-xs text-muted hover:text-accent"
                    >
                      Copy
                    </button>
                  </div>
                  <p className="text-foreground">{result.description}</p>
                </div>
              )}
              {result.ctaOptions?.length > 0 && (
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <span className="font-medium text-foreground">
                      CTA options
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        copyToClipboard(result.ctaOptions!.join("\n"))
                      }
                      className="text-xs text-muted hover:text-accent"
                    >
                      Copy all
                    </button>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    {result.ctaOptions.map((cta, i) => (
                      <button
                        key={i}
                        type="button"
                        onClick={() => copyToClipboard(cta)}
                        className="px-2.5 py-1 rounded-md border border-border bg-background text-foreground hover:border-accent transition-colors"
                      >
                        {cta}
                      </button>
                    ))}
                  </div>
                </div>
              )}
            </div>
          ) : (
            <p className="text-muted">
              Describe your offer or campaign and generate headline, body, and CTA options. Copy uses your brand voice, USPs, and review themes from Context Hub.
            </p>
          )}
        </div>
      </div>
    </div>
  );
}
