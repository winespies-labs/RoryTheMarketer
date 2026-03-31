"use client";

import { useState, useRef, useEffect } from "react";
import type { UnifiedSwipe } from "@/lib/unified-swipe";

const BRAND = "winespies";

export default function SwipeModalDrillTab({
  swipe,
  onRefresh,
  onUnsavedChange,
}: {
  swipe: UnifiedSwipe;
  onRefresh?: () => void;
  onUnsavedChange?: (hasUnsaved: boolean) => void;
}) {
  const [step, setStep] = useState(0);
  const [userInput, setUserInput] = useState("");
  const [saveStatus, setSaveStatus] = useState<
    "idle" | "saving" | "saved" | "error"
  >("idle");
  const [revealed, setRevealed] = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const hasExample = !!swipe.drillExample;
  const steps = hasExample
    ? ["Swipe", "Why It Works", "Your Turn", "Example"]
    : ["Swipe", "Why It Works", "Your Turn"];
  const maxStep = steps.length - 1;

  const hasUnsavedWork = userInput.trim().length > 0 && saveStatus !== "saved";

  useEffect(() => {
    onUnsavedChange?.(hasUnsavedWork);
  }, [hasUnsavedWork, onUnsavedChange]);

  useEffect(() => {
    if (step === 2 && textareaRef.current) {
      setTimeout(() => textareaRef.current?.focus(), 100);
    }
  }, [step]);

  const saveSwipe = async () => {
    if (!userInput.trim()) return;
    setSaveStatus("saving");
    try {
      const res = await fetch("/api/drill-journal", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: BRAND,
          techniqueId: swipe.techniqueId || swipe.category || "custom",
          techniqueLabel: swipe.category || "Custom",
          drillId: swipe.id,
          drillTitle: swipe.title,
          mechanism: swipe.mechanism || swipe.whyItWorks?.slice(0, 100) || "",
          originalSwipe: swipe.content,
          userVersion: userInput.trim(),
        }),
      });
      if (res.ok) {
        setSaveStatus("saved");
        onRefresh?.();
      } else {
        setSaveStatus("error");
      }
    } catch {
      setSaveStatus("error");
    }
  };

  return (
    <div>
      {/* Step indicator */}
      <div className="flex items-center gap-2 mb-6 text-xs tracking-widest uppercase text-accent">
        <span className="bg-accent text-white px-2 py-0.5 rounded text-[10px] font-bold">
          Step {step + 1}
        </span>
        {steps[step]}
        <div className="ml-auto flex gap-1.5">
          {steps.map((_, i) => (
            <div
              key={i}
              className={`w-2 h-2 rounded-full transition-colors ${
                i <= step ? "bg-accent" : "bg-border"
              }`}
            />
          ))}
        </div>
      </div>

      {/* Step 0: The Swipe */}
      {step === 0 && (
        <div>
          <p className="text-xs text-muted mb-4">
            Read this. Read it again. Notice what it does to you before you
            start analyzing it.
          </p>
          <div className="border-l-4 border-accent bg-background rounded-r-xl p-5">
            <p className="text-sm leading-loose italic whitespace-pre-line">
              &ldquo;{swipe.content}&rdquo;
            </p>
          </div>
          {swipe.mechanism && (
            <div className="flex gap-2 text-xs text-muted bg-background border border-border rounded-lg p-3 mt-4">
              <span className="text-accent font-medium shrink-0">
                Mechanism:
              </span>
              <span>{swipe.mechanism}</span>
            </div>
          )}
        </div>
      )}

      {/* Step 1: Why It Works */}
      {step === 1 && (
        <div>
          <div className="border-l-4 border-accent bg-background rounded-r-xl p-5">
            <p className="text-[11px] tracking-widest uppercase text-muted mb-3">
              The Swipe
            </p>
            <p className="text-sm leading-relaxed italic text-muted mb-5">
              &ldquo;{swipe.content}&rdquo;
            </p>
            <div className="h-px bg-border mb-5" />
            <p className="text-[11px] tracking-widest uppercase text-accent mb-3">
              Why It Works
            </p>
            <p className="text-sm leading-loose">
              {swipe.whyItWorks || "Open the Analysis tab to see AI analysis."}
            </p>
            {swipe.mechanism && (
              <div className="mt-4 bg-surface rounded-md p-3 flex gap-2 text-xs text-muted">
                <span className="text-accent font-medium shrink-0">
                  Mechanism:
                </span>
                <span>{swipe.mechanism}</span>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 2: Your Turn */}
      {step === 2 && (
        <div>
          <div className="bg-background border border-border rounded-xl p-4 mb-4">
            <p className="text-[11px] tracking-widest uppercase text-accent mb-2">
              The Prompt
            </p>
            <p className="text-sm leading-relaxed text-muted">
              {swipe.drillPrompt ||
                "Apply the mechanism from the swipe above. Write your own version. Match the structure, not the words."}
            </p>
          </div>
          <textarea
            ref={textareaRef}
            value={userInput}
            onChange={(e) => {
              setUserInput(e.target.value);
              if (saveStatus === "saved") setSaveStatus("idle");
            }}
            placeholder="Write your version here..."
            className="w-full min-h-[140px] p-4 border border-border rounded-xl bg-background text-sm leading-loose resize-y focus:outline-none focus:border-accent transition-colors"
          />
          {/* Prominent save CTA in Step 2 */}
          {userInput.trim() && (
            <button
              onClick={saveSwipe}
              disabled={saveStatus === "saving" || saveStatus === "saved"}
              className={`w-full mt-3 py-3 rounded-xl font-semibold text-sm transition-all ${
                saveStatus === "saved"
                  ? "bg-green-600 text-white"
                  : saveStatus === "error"
                    ? "bg-red-600 text-white hover:opacity-90"
                    : "bg-accent text-white hover:opacity-90"
              }`}
            >
              {saveStatus === "saving"
                ? "Saving..."
                : saveStatus === "saved"
                  ? "\u2713 Saved to Swipes"
                  : saveStatus === "error"
                    ? "Retry Save"
                    : "Save My Version"}
            </button>
          )}
        </div>
      )}

      {/* Step 3: Example (if available) */}
      {step === 3 && hasExample && (
        <div>
          {userInput && (
            <div className="mb-4">
              <div className="border-l-4 border-muted/40 bg-background rounded-r-xl p-4 mb-3">
                <p className="text-[11px] tracking-widest uppercase text-muted mb-2">
                  Your version
                </p>
                <p className="text-sm leading-loose italic">{userInput}</p>
              </div>
              <button
                onClick={saveSwipe}
                disabled={saveStatus === "saving" || saveStatus === "saved"}
                className={`w-full py-3 rounded-xl font-semibold text-sm transition-all ${
                  saveStatus === "saved"
                    ? "bg-green-600 text-white"
                    : saveStatus === "error"
                      ? "bg-red-600 text-white hover:opacity-90"
                      : "bg-accent text-white hover:opacity-90"
                }`}
              >
                {saveStatus === "saving"
                  ? "Saving..."
                  : saveStatus === "saved"
                    ? "\u2713 Saved to Swipes"
                    : saveStatus === "error"
                      ? "Retry Save"
                      : "Save My Version"}
              </button>
            </div>
          )}

          {!revealed ? (
            <button
              onClick={() => setRevealed(true)}
              className="w-full py-3 bg-accent text-white rounded-xl font-semibold text-sm hover:opacity-90 transition-opacity"
            >
              Reveal the Example
            </button>
          ) : (
            <div className="border-l-4 border-accent bg-background rounded-r-xl p-4">
              <p className="text-[11px] tracking-widest uppercase text-accent mb-2">
                Example
              </p>
              <p className="text-sm leading-loose italic">
                {swipe.drillExample}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Navigation */}
      <div className="flex justify-between items-center mt-6 pt-4 border-t border-border">
        <button
          onClick={() => step > 0 && setStep(step - 1)}
          disabled={step === 0}
          className="px-4 py-2 text-sm border border-border rounded-lg disabled:opacity-20 text-muted hover:border-accent hover:text-accent transition-colors"
        >
          &larr; Previous
        </button>

        {step < maxStep ? (
          <button
            onClick={() => setStep(step + 1)}
            className="px-5 py-2 text-sm border border-accent text-accent rounded-lg font-semibold hover:bg-accent hover:text-white transition-colors"
          >
            {step === 1 ? "Try It \u2192" : "Next \u2192"}
          </button>
        ) : (
          <div className="flex gap-2">
            {/* Save on last step if no example */}
            {!hasExample && userInput.trim() && (
              <button
                onClick={saveSwipe}
                disabled={saveStatus === "saving" || saveStatus === "saved"}
                className={`px-5 py-2 text-sm rounded-lg font-semibold transition-all ${
                  saveStatus === "saved"
                    ? "bg-green-600 text-white"
                    : saveStatus === "error"
                      ? "bg-red-600 text-white hover:opacity-90"
                      : "bg-accent text-white hover:opacity-90"
                }`}
              >
                {saveStatus === "saving"
                  ? "Saving..."
                  : saveStatus === "saved"
                    ? "\u2713 Saved!"
                    : saveStatus === "error"
                      ? "Retry"
                      : "Save My Version"}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
