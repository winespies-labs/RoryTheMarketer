"use client";

const STEPS = [
  { num: 1, label: "Select" },
  { num: 2, label: "Configure" },
  { num: 3, label: "Generate" },
];

interface StepIndicatorProps {
  currentStep: number;
  onStepClick: (step: number) => void;
  canNavigateTo: (step: number) => boolean;
}

export default function StepIndicator({
  currentStep,
  onStepClick,
  canNavigateTo,
}: StepIndicatorProps) {
  return (
    <div className="flex items-center justify-center gap-0 mb-6">
      {STEPS.map((step, idx) => {
        const isActive = currentStep === step.num;
        const isCompleted = currentStep > step.num;
        const canNav = canNavigateTo(step.num);

        return (
          <div key={step.num} className="flex items-center">
            {idx > 0 && (
              <div
                className={`w-12 h-0.5 ${
                  currentStep > idx ? "bg-accent" : "bg-border"
                }`}
              />
            )}
            <button
              type="button"
              onClick={() => canNav && onStepClick(step.num)}
              disabled={!canNav}
              className={`flex items-center gap-2 px-3 py-1.5 rounded-full text-sm font-medium transition-colors ${
                isActive
                  ? "bg-accent text-white"
                  : isCompleted
                    ? "bg-accent/10 text-accent"
                    : "bg-background text-muted"
              } ${canNav && !isActive ? "cursor-pointer hover:opacity-80" : ""} ${
                !canNav ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              <span
                className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-bold ${
                  isActive
                    ? "bg-white/20 text-white"
                    : isCompleted
                      ? "bg-accent text-white"
                      : "bg-border text-muted"
                }`}
              >
                {isCompleted ? "✓" : step.num}
              </span>
              {step.label}
            </button>
          </div>
        );
      })}
    </div>
  );
}
