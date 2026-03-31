"use client";

import { useState, useRef, useEffect } from "react";
import type { AssetCategory } from "@/lib/brand-assets";
import { ASSET_CATEGORIES } from "@/lib/brand-assets";

interface SaveToLibraryButtonProps {
  brandId: string;
  file: File;
  defaultLabel?: string;
  defaultCategory?: AssetCategory;
}

export default function SaveToLibraryButton({
  brandId,
  file,
  defaultLabel,
  defaultCategory = "product",
}: SaveToLibraryButtonProps) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState(defaultLabel ?? file.name.replace(/\.[^.]+$/, ""));
  const [category, setCategory] = useState<AssetCategory>(defaultCategory);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const popoverRef = useRef<HTMLDivElement>(null);

  // Close popover on outside click
  useEffect(() => {
    if (!open) return;
    const handler = (e: MouseEvent) => {
      if (popoverRef.current && !popoverRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [open]);

  const handleSave = async () => {
    setSaving(true);
    try {
      const fd = new FormData();
      fd.append("image", file);
      fd.append("brand", brandId);
      fd.append("label", label.trim() || file.name.replace(/\.[^.]+$/, ""));
      fd.append("category", category);
      const res = await fetch("/api/brand-assets/upload", { method: "POST", body: fd });
      if (res.ok) {
        setSaved(true);
        setOpen(false);
      }
    } catch {
      // ignore
    } finally {
      setSaving(false);
    }
  };

  if (saved) {
    return (
      <span className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-green-100 text-green-600 text-[10px]" title="Saved to library">
        ✓
      </span>
    );
  }

  return (
    <div className="relative" ref={popoverRef}>
      <button
        type="button"
        onClick={(e) => { e.stopPropagation(); setOpen(!open); }}
        className="inline-flex items-center justify-center w-6 h-6 rounded-full bg-surface/90 border border-border text-muted hover:text-accent text-[10px] transition-colors"
        title="Save to asset library"
      >
        ↓
      </button>

      {open && (
        <div className="absolute bottom-8 right-0 z-20 w-52 bg-surface border border-border rounded-lg shadow-lg p-3 space-y-2">
          <p className="text-[10px] font-medium text-muted">Save to Library</p>
          <input
            type="text"
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            placeholder="Label"
            className="w-full px-2 py-1 text-xs border border-border rounded bg-background"
            onClick={(e) => e.stopPropagation()}
          />
          <select
            value={category}
            onChange={(e) => setCategory(e.target.value as AssetCategory)}
            className="w-full px-2 py-1 text-xs border border-border rounded bg-background"
            onClick={(e) => e.stopPropagation()}
          >
            {ASSET_CATEGORIES.map((c) => (
              <option key={c.value} value={c.value}>{c.label}</option>
            ))}
          </select>
          <button
            type="button"
            onClick={(e) => { e.stopPropagation(); handleSave(); }}
            disabled={saving}
            className="w-full px-2 py-1 text-xs font-medium bg-accent text-white rounded hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      )}
    </div>
  );
}
