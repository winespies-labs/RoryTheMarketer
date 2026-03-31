"use client";

import { useState } from "react";

export type ReferenceAdSummary = {
  id: string;
  label: string;
  angle?: string;
  nanoBanana?: string;
  imageFile?: string;
  platform?: string;
  format?: string;
  type?: string;
  aspectRatio?: string;
  notes?: string;
};

interface StepSelectProps {
  referenceAds: ReferenceAdSummary[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onNext: () => void;
  onCreateNew: () => void;
  onEdit: (id: string) => void;
  onDelete: (id: string) => void;
}

export default function StepSelect({
  referenceAds,
  selectedIds,
  onToggle,
  onNext,
  onCreateNew,
  onEdit,
  onDelete,
}: StepSelectProps) {
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

  const handleDelete = (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    if (confirmDeleteId === id) {
      onDelete(id);
      setConfirmDeleteId(null);
    } else {
      setConfirmDeleteId(id);
    }
  };

  return (
    <div className="space-y-4">
      {/* Create button */}
      <div className="flex items-center justify-end">
        <button
          type="button"
          onClick={onCreateNew}
          className="flex-shrink-0 w-8 h-8 flex items-center justify-center rounded-lg border border-border bg-background hover:border-accent/50 hover:bg-accent/10 transition-colors text-accent font-bold text-lg"
          title="Add new reference ad"
        >
          +
        </button>
      </div>

      {/* Card grid */}
      {referenceAds.length === 0 ? (
        <div className="text-center py-12 text-muted text-sm">
          No reference ads found.
          <button
            type="button"
            onClick={onCreateNew}
            className="ml-1 text-accent hover:underline"
          >
            Create one
          </button>
          {" "}or add markdown files to <code className="text-xs">context/Examples/Ads/Static/</code>.
        </div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4">
          {referenceAds.map((ad) => {
            const isSelected = selectedIds.has(ad.id);

            return (
              <div
                key={ad.id}
                className={`group relative rounded-lg border-2 overflow-hidden text-left transition-all ${
                  isSelected
                    ? "border-accent ring-2 ring-accent/30"
                    : "border-border hover:border-accent/40"
                }`}
              >
                {/* Main clickable area */}
                <button
                  type="button"
                  onClick={() => onToggle(ad.id)}
                  className="w-full text-left"
                >
                  {/* Thumbnail */}
                  <div className="relative aspect-square bg-background">
                    {ad.imageFile ? (
                      <img
                        src={`/api/ad-reference/image?id=${ad.id}`}
                        alt={ad.label}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-muted text-xs">
                        No preview
                      </div>
                    )}

                    {/* Selection indicator */}
                    {isSelected && (
                      <div className="absolute top-2 left-2 w-5 h-5 rounded-full bg-accent text-white flex items-center justify-center text-xs font-bold">
                        ✓
                      </div>
                    )}
                  </div>

                  {/* Info */}
                  <div className="p-2">
                    <p className="text-xs font-medium truncate">{ad.label}</p>
                  </div>
                </button>

                {/* Action buttons (visible on hover) */}
                <div className="absolute bottom-1 right-1 flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEdit(ad.id);
                    }}
                    className="w-6 h-6 flex items-center justify-center rounded bg-background/90 border border-border text-muted hover:text-accent hover:border-accent/50 transition-colors"
                    title="Edit"
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M8.5 1.5L10.5 3.5L4 10H2V8L8.5 1.5Z" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                  <button
                    type="button"
                    onClick={(e) => handleDelete(e, ad.id)}
                    className={`w-6 h-6 flex items-center justify-center rounded border transition-colors ${
                      confirmDeleteId === ad.id
                        ? "bg-red-600 border-red-600 text-white"
                        : "bg-background/90 border-border text-muted hover:text-red-500 hover:border-red-300"
                    }`}
                    title={confirmDeleteId === ad.id ? "Click again to confirm" : "Delete"}
                    onBlur={() => setConfirmDeleteId(null)}
                  >
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2 3H10M4.5 5.5V8.5M7.5 5.5V8.5M3 3L3.5 10H8.5L9 3M5 3V1.5H7V3" stroke="currentColor" strokeWidth="1.2" strokeLinecap="round" strokeLinejoin="round"/>
                    </svg>
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sticky bottom bar */}
      {selectedIds.size > 0 && (
        <div className="sticky bottom-0 bg-surface border-t border-border -mx-6 px-6 py-3 flex items-center justify-between">
          <span className="text-sm text-muted">
            {selectedIds.size} template{selectedIds.size !== 1 ? "s" : ""} selected
          </span>
          <button
            type="button"
            onClick={onNext}
            className="px-5 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:opacity-90 transition-opacity"
          >
            Next: Configure →
          </button>
        </div>
      )}
    </div>
  );
}
