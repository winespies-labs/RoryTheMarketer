"use client";

import type { GeneratedAd } from "@/lib/ad-builder";

interface StepGenerateProps {
  brandId: string;
  generations: GeneratedAd[];
  progress: { current: number; total: number; message: string } | null;
  onDelete: (id: string) => void;
  onBack: () => void;
}

export default function StepGenerate({
  brandId,
  generations,
  progress,
  onDelete,
  onBack,
}: StepGenerateProps) {
  const genImgUrl = (gen: GeneratedAd) =>
    `/api/ad-builder/images?brand=${brandId}&path=generated/${gen.filename}`;

  const handleDownloadAll = async () => {
    for (const gen of generations) {
      const a = document.createElement("a");
      a.href = genImgUrl(gen);
      a.download = `ad-${gen.styleName.toLowerCase().replace(/\s+/g, "-")}-${gen.id}.png`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // Small delay between downloads
      await new Promise((r) => setTimeout(r, 200));
    }
  };

  return (
    <div className="space-y-6">
      {/* Back button */}
      <button
        type="button"
        onClick={onBack}
        className="text-sm text-muted hover:text-foreground transition-colors"
      >
        ← Back to Configure
      </button>

      {/* Progress section */}
      {progress && (
        <div className="rounded-xl border border-border bg-surface p-6">
          <div className="flex items-center justify-between mb-2">
            <p className="text-sm font-medium">{progress.message}</p>
            <p className="text-xs text-muted">
              {progress.current}/{progress.total}
            </p>
          </div>
          <div className="w-full bg-border rounded-full h-2">
            <div
              className="bg-accent h-2 rounded-full transition-all duration-300"
              style={{
                width: `${progress.total > 0 ? (progress.current / progress.total) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Results gallery */}
      {generations.length > 0 ? (
        <div className="rounded-xl border border-border bg-surface p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-medium text-foreground">
              Generated Ads ({generations.length})
            </h2>
            {generations.length > 1 && (
              <button
                type="button"
                onClick={handleDownloadAll}
                className="px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-lg hover:opacity-90"
              >
                Download All
              </button>
            )}
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
            {generations.map((gen) => (
              <div
                key={gen.id}
                className="rounded-lg border border-border overflow-hidden"
              >
                <img
                  src={genImgUrl(gen)}
                  alt={gen.styleName}
                  className="w-full aspect-square object-cover"
                />
                <div className="p-3 space-y-2">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium truncate flex-1">
                      {gen.styleName}
                    </p>
                    {gen.backend && (
                      <span
                        className={`px-1.5 py-0.5 text-[10px] font-medium rounded ${
                          gen.backend === "fal"
                            ? "bg-green-100 text-green-700"
                            : "bg-blue-100 text-blue-700"
                        }`}
                      >
                        {gen.backend === "fal" ? "FAL" : "Gemini"}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-muted truncate">
                    {gen.wineDetails.headline}
                  </p>
                  <div className="flex gap-2">
                    <a
                      href={genImgUrl(gen)}
                      download={`ad-${gen.styleName.toLowerCase().replace(/\s+/g, "-")}-${gen.id}.png`}
                      className="text-xs text-accent hover:underline"
                    >
                      Download
                    </a>
                    <button
                      type="button"
                      onClick={() => onDelete(gen.id)}
                      className="text-xs text-muted hover:text-danger transition-colors"
                    >
                      Delete
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : !progress ? (
        <div className="text-center py-16 text-muted text-sm">
          No ads generated yet. Go back to Configure to set up and generate ads.
        </div>
      ) : null}
    </div>
  );
}
