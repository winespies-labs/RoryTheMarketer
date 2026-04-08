"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import type { AssetCategory } from "@/lib/brand-assets";
import { ASSET_CATEGORIES } from "@/lib/brand-assets";

const BRAND_ID = "winespies";

type BrandAssetItem = {
  id: string;
  label: string;
  category: AssetCategory;
  filename: string;
  originalName?: string;
  uploadedAt: string;
};

const ALL_FILTER = "all" as const;
type FilterValue = AssetCategory | typeof ALL_FILTER;

export default function BrandAssetsPanel({
  onChanged,
}: {
  onChanged?: () => void;
}) {
  const [assets, setAssets] = useState<BrandAssetItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | undefined>();
  const [storageMode, setStorageMode] = useState<"database" | "filesystem" | null>(null);
  const [filter, setFilter] = useState<FilterValue>(ALL_FILTER);

  // Upload form state
  const [uploadFile, setUploadFile] = useState<File | null>(null);
  const [uploadPreview, setUploadPreview] = useState<string>();
  const [uploadLabel, setUploadLabel] = useState("");
  const [uploadCategory, setUploadCategory] = useState<AssetCategory>("logo");
  const [uploading, setUploading] = useState(false);
  const [deleting, setDeleting] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const fetchAssets = useCallback(async () => {
    setLoading(true);
    setLoadError(null);
    try {
      const res = await fetch(`/api/brand-assets?brand=${BRAND_ID}`);
      const data = await res.json();
      if (!res.ok) {
        setLoadError(data.error ?? `HTTP ${res.status}`);
        return;
      }
      setAssets(data.assets ?? []);
      setUpdatedAt(data.updatedAt);
      setStorageMode(data.storageMode ?? null);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : "Failed to load assets");
    } finally {
      setLoading(false);
    }
  }, []);

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
    setUploadError(null);
    try {
      const fd = new FormData();
      fd.append("image", uploadFile);
      fd.append("brand", BRAND_ID);
      fd.append("label", uploadLabel.trim() || uploadFile.name.replace(/\.[^.]+$/, ""));
      fd.append("category", uploadCategory);
      const res = await fetch("/api/brand-assets/upload", { method: "POST", body: fd });
      const data = await res.json().catch(() => ({}));
      if (res.ok) {
        setUploadFile(null);
        setUploadPreview(undefined);
        setUploadLabel("");
        setUploadCategory("logo");
        fetchAssets();
        onChanged?.();
      } else {
        setUploadError(data.error ?? `Upload failed (HTTP ${res.status})`);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeleting(id);
    try {
      const res = await fetch(`/api/brand-assets?brand=${BRAND_ID}&id=${id}`, { method: "DELETE" });
      if (res.ok) {
        setAssets((prev) => prev.filter((a) => a.id !== id));
        onChanged?.();
      }
    } catch {
      // ignore
    } finally {
      setDeleting(null);
    }
  };

  const filtered = filter === ALL_FILTER ? assets : assets.filter((a) => a.category === filter);

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Brand Assets</h2>

      <div className="rounded-lg border border-border bg-surface p-5 space-y-5">
        <p className="text-sm text-muted">
          Upload and manage logos, badges, product images, and backgrounds. These assets are available when building ad creatives.
        </p>

        {/* Storage mode warning */}
        {storageMode === "filesystem" && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 px-3 py-2.5 text-xs text-amber-800">
            <span className="font-semibold">Ephemeral storage</span> — assets are saved to disk and will be lost on the next deployment. Set{" "}
            <code className="font-mono bg-amber-100 px-1 rounded">DATABASE_URL</code> in your Railway environment variables to persist assets in Postgres.
          </div>
        )}
        {storageMode === "database" && (
          <div className="rounded-lg bg-green-50 border border-green-200 px-3 py-2.5 text-xs text-green-800">
            <span className="font-semibold">Postgres storage</span> — assets are stored in the database and will survive deployments.
          </div>
        )}

        {/* Load error */}
        {loadError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-xs text-red-700">
            <span className="font-semibold">Error loading assets:</span> {loadError}
          </div>
        )}

        {/* Stats */}
        <div className="text-sm text-muted">
          {updatedAt
            ? `Last updated: ${new Date(updatedAt).toLocaleString()}`
            : "No assets yet"}
          {assets.length > 0 && (
            <span className="ml-2">
              — {assets.length} asset{assets.length !== 1 ? "s" : ""}
            </span>
          )}
        </div>

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
                placeholder="Label (e.g. Primary Logo)"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
              />
              <div className="flex gap-2">
                <select
                  value={uploadCategory}
                  onChange={(e) => setUploadCategory(e.target.value as AssetCategory)}
                  className="flex-1 px-3 py-2 text-sm border border-border rounded-lg bg-background"
                >
                  {ASSET_CATEGORIES.map((c) => (
                    <option key={c.value} value={c.value}>{c.label}</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={handleUpload}
                  disabled={!uploadFile || uploading}
                  className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
                >
                  {uploading ? "Uploading..." : "Upload"}
                </button>
              </div>
            </div>
          </div>
        </div>

        {uploadError && (
          <div className="rounded-lg bg-red-50 border border-red-200 px-3 py-2.5 text-xs text-red-700">
            <span className="font-semibold">Upload failed:</span> {uploadError}
          </div>
        )}

        {/* Category filter pills */}
        <div className="flex flex-wrap gap-1.5">
          <button
            type="button"
            onClick={() => setFilter(ALL_FILTER)}
            className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
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
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
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
          <p className="text-sm text-muted py-8 text-center">Loading...</p>
        ) : filtered.length === 0 ? (
          <p className="text-sm text-muted py-8 text-center">
            {assets.length === 0
              ? "No assets yet. Upload one above."
              : "No assets in this category."}
          </p>
        ) : (
          <div className="grid grid-cols-4 gap-3">
            {filtered.map((asset) => (
              <div
                key={asset.id}
                className="group relative rounded-lg border border-border bg-background overflow-hidden"
              >
                <div className="aspect-square">
                  <img
                    src={`/api/brand-assets/image?brand=${BRAND_ID}&id=${asset.id}`}
                    alt={asset.label}
                    className="w-full h-full object-contain"
                  />
                </div>
                <div className="px-2 py-1.5 border-t border-border">
                  <p className="text-xs font-medium text-foreground truncate">{asset.label}</p>
                  <p className="text-[10px] text-muted capitalize">{asset.category}</p>
                </div>
                {/* Delete button on hover */}
                <button
                  type="button"
                  onClick={() => handleDelete(asset.id)}
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
  );
}
