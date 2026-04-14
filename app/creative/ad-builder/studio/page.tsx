// app/creative/ad-builder/studio/page.tsx
"use client";

import Link from "next/link";
import { useState } from "react";
import StylePicker from "./components/StylePicker";
import ContentConfigurator, { type ContentTokens } from "./components/ContentConfigurator";
import GeneratePanel, { type GeneratedImage } from "./components/GeneratePanel";
import DownloadPublishPanel from "./components/DownloadPublishPanel";
import type { StudioStyle } from "./hooks/useStudioStyles";

const BRAND = "winespies";

const STEPS = [
  { n: 1, label: "Pick Style" },
  { n: 2, label: "Configure" },
  { n: 3, label: "Generate" },
  { n: 4, label: "Publish" },
] as const;

function StepIndicator({ current }: { current: number }) {
  return (
    <div className="flex items-center gap-0 shrink-0">
      {STEPS.map((step, i) => (
        <div key={step.n} className="flex items-center">
          <div className="flex items-center gap-1.5">
            <div
              className={`w-6 h-6 rounded-full text-xs font-semibold flex items-center justify-center ${
                current === step.n
                  ? "bg-accent text-white"
                  : current > step.n
                  ? "bg-accent/20 text-accent"
                  : "bg-border text-muted"
              }`}
            >
              {current > step.n ? (
                <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : step.n}
            </div>
            <span className={`text-xs hidden sm:block ${current === step.n ? "text-foreground font-medium" : "text-muted"}`}>
              {step.label}
            </span>
          </div>
          {i < STEPS.length - 1 && (
            <div className={`w-8 h-px mx-2 ${current > step.n ? "bg-accent/40" : "bg-border"}`} />
          )}
        </div>
      ))}
    </div>
  );
}

export default function CreativeStudio() {
  const [step, setStep] = useState(1);
  const [selectedStyle, setSelectedStyle] = useState<StudioStyle | null>(null);
  const [tokens, setTokens] = useState<ContentTokens | null>(null);
  const [generatedImages, setGeneratedImages] = useState<GeneratedImage[]>([]);

  const handleStyleSelect = (style: StudioStyle) => {
    setSelectedStyle(style);
  };

  const handleStyleNext = () => {
    if (selectedStyle) setStep(2);
  };

  const handleContentComplete = (t: ContentTokens) => {
    setTokens(t);
    setStep(3);
  };

  const handleGenerated = (images: GeneratedImage[]) => {
    setGeneratedImages(images);
    if (images.length > 0) setStep(4);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-3">
          <Link
            href="/creative/ad-builder"
            className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Ad Builder
          </Link>
          <span className="text-border">|</span>
          <h1 className="text-sm font-semibold">Creative Ad Studio</h1>
        </div>
        <StepIndicator current={step} />
      </div>

      {/* Main content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-2xl mx-auto px-4 py-6">

          {/* Step 1: Pick Style */}
          {step === 1 && (
            <div className="flex flex-col gap-4">
              <div>
                <h2 className="text-base font-semibold">Pick a Style</h2>
                <p className="text-xs text-muted mt-0.5">Choose a reference ad template to base your ad on.</p>
              </div>
              <StylePicker
                selected={selectedStyle}
                onSelect={handleStyleSelect}
                brand={BRAND}
              />
              {selectedStyle && (
                <div className="sticky bottom-4">
                  <button
                    type="button"
                    onClick={handleStyleNext}
                    className="w-full py-3 text-sm bg-accent text-white rounded-xl hover:bg-accent/90 transition-colors font-medium shadow-lg"
                  >
                    Continue with {selectedStyle.label} →
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Configure Content */}
          {step === 2 && selectedStyle && (
            <ContentConfigurator
              style={selectedStyle}
              brand={BRAND}
              onComplete={handleContentComplete}
              onBack={() => setStep(1)}
            />
          )}

          {/* Step 3: Generate */}
          {step === 3 && selectedStyle && tokens && (
            <GeneratePanel
              style={selectedStyle}
              tokens={tokens}
              onBack={() => setStep(2)}
              onGenerated={handleGenerated}
            />
          )}

          {/* Step 4: Download / Publish */}
          {step === 4 && generatedImages.length > 0 && tokens && (
            <DownloadPublishPanel
              images={generatedImages}
              brand={BRAND}
              headline={tokens.headline}
              primaryText={tokens.primaryText}
              onBack={() => setStep(3)}
            />
          )}
        </div>
      </div>
    </div>
  );
}
