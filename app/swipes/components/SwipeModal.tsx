"use client";

import { useState, useCallback } from "react";
import type { UnifiedSwipe } from "@/lib/unified-swipe";
import { getLibraryId } from "@/lib/unified-swipe";
import SwipeModalAnalyzeTab from "./SwipeModalAnalyzeTab";
import SwipeModalDrillTab from "./SwipeModalDrillTab";

type Tab = "analysis" | "drill" | "edit";

const BRAND_ID = "winespies";
const SWIPE_TYPES = ["swipe", "copywriting", "ad_copy"] as const;

export default function SwipeModal({
  swipe,
  onClose,
  onRefresh,
}: {
  swipe: UnifiedSwipe;
  onClose: () => void;
  onRefresh: () => void;
}) {
  const [tab, setTab] = useState<Tab>("analysis");
  const isLibrary = swipe.source === "library";
  const libraryId = getLibraryId(swipe);

  // Drill unsaved-work tracking
  const [drillHasUnsaved, setDrillHasUnsaved] = useState(false);

  const handleClose = useCallback(() => {
    if (drillHasUnsaved && tab === "drill") {
      if (!confirm("You have unsaved drill work. Close anyway?")) return;
    }
    onClose();
  }, [drillHasUnsaved, tab, onClose]);

  // Edit state (library only)
  const [editTagsStr, setEditTagsStr] = useState(swipe.tags.join(", "));
  const [editType, setEditType] = useState(swipe.libraryType || "swipe");
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const tabs: { id: Tab; label: string }[] = [
    { id: "analysis", label: "Analysis" },
    { id: "drill", label: "Drill" },
    ...(isLibrary ? [{ id: "edit" as Tab, label: "Edit" }] : []),
  ];

  const handleSaveEdit = async () => {
    if (!libraryId) return;
    setSaving(true);
    setEditError(null);
    try {
      const tags = editTagsStr
        .split(/[\s,]+/)
        .map((t) => t.trim())
        .filter(Boolean);

      const res = await fetch("/api/context-library", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: BRAND_ID,
          id: libraryId,
          type: editType,
          tags: tags.length ? tags : undefined,
        }),
      });

      if (!res.ok) {
        const d = await res.json();
        throw new Error(d?.error || "Failed to update swipe");
      }

      onRefresh();
      onClose();
    } catch (err) {
      setEditError(err instanceof Error ? err.message : "Failed to update");
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!libraryId || !confirm("Delete this swipe?")) return;
    const res = await fetch(
      `/api/context-library?brand=${BRAND_ID}&id=${libraryId}`,
      { method: "DELETE" }
    );
    if (res.ok) {
      onRefresh();
      onClose();
    }
  };

  return (
    <div
      className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50"
      role="dialog"
      aria-modal="true"
      onClick={handleClose}
    >
      <div
        className="bg-surface border border-border rounded-xl w-full max-w-3xl max-h-[85vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="sticky top-0 bg-surface border-b border-border px-5 pt-4 pb-0 z-10 rounded-t-xl">
          <div className="flex items-start justify-between gap-4 mb-3">
            <div className="min-w-0">
              <h3 className="text-base font-semibold truncate">
                {swipe.title}
              </h3>
              <div className="text-xs text-muted mt-1">
                {swipe.source === "library" && swipe.addedAt
                  ? `${swipe.libraryType} \u00b7 ${new Date(swipe.addedAt).toLocaleDateString()}`
                  : swipe.source === "drill"
                    ? `Drill \u00b7 ${swipe.category}`
                    : `Extracted \u00b7 ${swipe.category}`}
              </div>
            </div>
            <button
              type="button"
              onClick={handleClose}
              className="px-3 py-1.5 text-sm border border-border rounded-lg bg-background hover:bg-surface shrink-0"
            >
              Close
            </button>
          </div>

          {/* Tab bar */}
          <div className="flex gap-1 -mb-px">
            {tabs.map((t) => (
              <button
                key={t.id}
                onClick={() => setTab(t.id)}
                className={`px-4 py-2 text-sm border-b-2 transition-colors ${
                  tab === t.id
                    ? "border-accent text-accent font-medium"
                    : "border-transparent text-muted hover:text-foreground"
                }`}
              >
                {t.label}
              </button>
            ))}
          </div>
        </div>

        {/* Body */}
        <div className="p-5">
          {/* Swipe text (always visible) */}
          <div className="mb-5">
            <div className="text-xs font-medium text-muted mb-2">
              Swipe text
            </div>
            <div className="text-sm whitespace-pre-wrap text-muted leading-relaxed border-l-4 border-accent/30 pl-4">
              {swipe.content}
            </div>
          </div>

          {/* Tab content */}
          {tab === "analysis" && <SwipeModalAnalyzeTab swipe={swipe} />}
          {tab === "drill" && (
            <SwipeModalDrillTab
              swipe={swipe}
              onRefresh={onRefresh}
              onUnsavedChange={setDrillHasUnsaved}
            />
          )}
          {tab === "edit" && isLibrary && (
            <div className="space-y-4">
              <div>
                <label className="block text-xs text-muted mb-1">Type</label>
                <select
                  value={editType}
                  onChange={(e) => setEditType(e.target.value)}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
                >
                  {SWIPE_TYPES.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-muted mb-1">
                  Tags (comma-separated)
                </label>
                <input
                  type="text"
                  value={editTagsStr}
                  onChange={(e) => setEditTagsStr(e.target.value)}
                  placeholder="e.g. urgency, pricing, openers"
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
                />
              </div>

              {editError && (
                <p className="text-xs text-danger bg-red-50 border border-red-200 rounded-lg p-2">
                  {editError}
                </p>
              )}

              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleDelete}
                  className="text-xs text-danger hover:underline"
                >
                  Delete swipe
                </button>
                <button
                  type="button"
                  onClick={handleSaveEdit}
                  disabled={saving}
                  className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:opacity-90 disabled:opacity-50"
                >
                  {saving ? "Saving..." : "Save Changes"}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
