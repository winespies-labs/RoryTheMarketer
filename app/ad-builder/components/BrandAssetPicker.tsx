"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { AssetCategory } from "@/lib/brand-assets";
import { ASSET_CATEGORIES } from "@/lib/brand-assets";

type BrandAssetItem = {
  id: string;
  label: string;
  category: AssetCategory;
  filename: string;
  originalName?: string;
  uploadedAt: string;
};

interface BrandAssetPickerProps {
  brandId: string;
  filterCategory?: AssetCategory;
  onSelect: (asset: { id: string; label: string; url: string }) => void;
  onClose: () => void;
}

const ALL_FILTER = "all" as const;
type FilterValue = AssetCategory | typeof ALL_FILTER;

export default function BrandAssetPicker({
  brandId,
  filterCategory,
  onSelect,
  onClose,
}: BrandAssetPickerProps) {
  const [assets, setAssets] = useState<BrandAssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterValue>(filterCategory ?? ALL_FILTER);

  // Upload form state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string>();
  const [uploadLabel, setUploadLabel] = useState("");
  const [uploadCategory, setUploadCategory] = useState<AssetCategory>(filterCategory ?? "other");
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch(`/api/brand-assets?brand=${brandId}`);
      const data = await res.json();
      setAssets(data.assets ?? []);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [brandId]);

  useEffect(() => {
    fetchAssets();
  }, [fetchAssets]);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadFile(file);
    setUploadPreview(URL.createObjectURL(file));
    if (!uploadLabel) setUploadLabel(file.name.replace(/\.[^.]+$/, ""));
    e.target.value = "";
  };

  const handleUpload = async () => {
    if (!uploadFile) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("image", uploadFile);
      fd.append("brand", brandId);
      fd.append("label", uploadLabel.trim() || uploadFile.name.replace(/\.[^.]+$/, ""));
      fd.append("category", uploadCategory);
      const res = await fetch("/api/brand-assets/upload", { method: "POST", body: fd });
      if (res.ok) {
        setUploadFile(null);
        setUploadPreview(undefined);
        setUploadLabel("");
        fetchAssets();
      }
    } catch {
      // ignore
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      const res = await fetch(`/api/brand-assets?brand=${brandId}&id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setAssets((prev) => prev.filter((a) => a.id !== id));
      }
    } catch {
      // ignore
    } finally {
      setDeleting(null);
    }
  };

  const filtered = filter === ALL_FILTER ? assets : assets.filter((a) => a.category === filter);

  return (
    <div className="fixed inset-0 z-50 flex">
      {/* Backdrop */}
      <div className="flex-1 bg-black/40" onClick={onClose} />

      {/* Panel */}
      <div className="w-full max-w-lg bg-surface border-l border-border overflow-y-auto">
        {/* Header */}
        <div className="sticky top-0 bg-surface border-b border-border px-6 py-4 flex items-center justify-between z-10">
          <h2 className="text-lg font-semibold">Brand Asset Library</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-muted hover:text-foreground text-xl leading-none"
          >
            &times;
          </button>
        </div>

        <div className="p-6 space-y-5">
          {/* Upload section */}
          <div className="rounded-lg border border-dashed border-border p-4 space-y-3">
            <p className="text-xs font-medium text-muted">Add New Asset</p>
            <div className="flex items-start gap-3">
              {uploadPreview ? (
                <div className="relative w-16 h-16 rounded-lg border border-border bg-background overflow-hidden flex-shrink-0">
                  <img src={uploadPreview} alt="Preview" className="w-full h-full object-contain" />
                  <button
                    type="button"
                    onClick={() => { setUploadFile(null); setUploadPreview(undefined); setUploadLabel(""); }}
                    className="absolute top-0.5 right-0.5 w-4 h-4 flex items-center justify-center rounded-full bg-surface text-muted text-[9px]"
                  >
                    x
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="w-16 h-16 rounded-lg border-2 border-dashed border-border hover:border-accent/50 bg-background flex items-center justify-center text-muted text-lg flex-shrink-0 transition-colors"
                >
                  +
                </button>
              )}
              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleFileSelect}
                className="hidden"
              />
              <div className="flex-1 space-y-2">
                <input
                  type="text"
                  value={uploadLabel}
                  onChange={(e) => setUploadLabel(e.target.value)}
                  placeholder="Label"
                  className="w-full px-2 py-1 text-xs border border-border rounded bg-background"
                />
                <div className="flex gap-2">
                  <select
                    value={uploadCategory}
                    onChange={(e) => setUploadCategory(e.target.value as AssetCategory)}
                    className="flex-1 px-2 py-1 text-xs border border-border rounded bg-background"
                  >
                    {ASSET_CATEGORIES.map((c) => (
                      <option key={c.value} value={c.value}>{c.label}</option>
                    ))}
                  </select>
                  <button
                    type="button"
                    onClick={handleUpload}
                    disabled={!uploadFile || uploading}
                    className="px-3 py-1 text-xs font-medium bg-accent text-white rounded hover:opacity-90 disabled:opacity-50 transition-opacity"
                  >
                    {uploading ? "..." : "Upload"}
                  </button>
                </div>
              </div>
            </div>
          </div>

          {/* Category filter pills */}
          <div className="flex flex-wrap gap-1.5">
            <button
              type="button"
              onClick={() => setFilter(ALL_FILTER)}
              className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors ${
                filter === ALL_FILTER
                  ? "bg-accent text-white border-accent"
                  : "bg-background text-muted border-border hover:border-accent/50"
              }`}
            >
              All
            </button>
            {ASSET_CATEGORIES.map((c) => (
              <button
                key={c.value}
                type="button"
                onClick={() => setFilter(c.value)}
                className={`px-2.5 py-1 text-[11px] font-medium rounded-full border transition-colors ${
                  filter === c.value
                    ? "bg-accent text-white border-accent"
                    : "bg-background text-muted border-border hover:border-accent/50"
                }`}
              >
                {c.label}
              </button>
            ))}
          </div>

          {/* Asset grid */}
          {loading ? (
            <p className="text-xs text-muted py-8 text-center">Loading...</p>
          ) : filtered.length === 0 ? (
            <p className="text-xs text-muted py-8 text-center">No assets yet. Upload one above.</p>
          ) : (
            <div className="grid grid-cols-3 gap-3">
              {filtered.map((asset) => (
                <div
                  key={asset.id}
                  className="group relative rounded-lg border border-border bg-background overflow-hidden cursor-pointer hover:border-accent/50 transition-colors"
                  onClick={() =>
                    onSelect({
                      id: asset.id,
                      label: asset.label,
                      url: `/api/brand-assets/image?brand=${brandId}&id=${asset.id}`,
                    })
                  }
                >
                  <div className="aspect-square">
                    <img
                      src={`/api/brand-assets/image?brand=${brandId}&id=${asset.id}`}
                      alt={asset.label}
                      className="w-full h-full object-contain"
                    />
                  </div>
                  <div className="px-2 py-1.5 border-t border-border">
                    <p className="text-[10px] font-medium text-foreground truncate">{asset.label}</p>
                    <p className="text-[9px] text-muted capitalize">{asset.category}</p>
                  </div>
                  {/* Delete button on hover */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(asset.id);
                    }}
                    disabled={deleting === asset.id}
                    className="absolute top-1 right-1 w-5 h-5 flex items-center justify-center rounded-full bg-surface/90 border border-border text-muted hover:text-red-500 text-[10px] opacity-0 group-hover:opacity-100 transition-opacity"
                  >
                    {deleting === asset.id ? "..." : "x"}
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
