"use client";

import { useState, useRef } from "react";
import type { AdStyle } from "@/lib/ad-builder";

interface StylePickerProps {
  brandId: string;
  styles: AdStyle[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onStyleAdded: (style: AdStyle) => void;
  onStyleDeleted: (id: string) => void;
}

export default function StylePicker({
  brandId,
  styles,
  selectedIds,
  onToggle,
  onStyleAdded,
  onStyleDeleted,
}: StylePickerProps) {
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState("");
  const [newFile, setNewFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const handleAdd = async () => {
    if (!newName.trim() || !newFile) return;
    setUploading(true);
    try {
      const fd = new FormData();
      fd.append("brand", brandId);
      fd.append("name", newName.trim());
      fd.append("image", newFile);
      const res = await fetch("/api/ad-builder/styles", {
        method: "POST",
        body: fd,
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error);
      onStyleAdded(data.style);
      setNewName("");
      setNewFile(null);
      setAdding(false);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to add style");
    } finally {
      setUploading(false);
    }
  };

  const handleDelete = async (id: string) => {
    setDeletingId(id);
    try {
      const res = await fetch(
        `/api/ad-builder/styles?brand=${brandId}&id=${id}`,
        { method: "DELETE" }
      );
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.error);
      }
      onStyleDeleted(id);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to delete style");
    } finally {
      setDeletingId(null);
    }
  };

  const imgUrl = (style: AdStyle) =>
    `/api/ad-builder/images?brand=${brandId}&path=styles/${style.filename}`;

  return (
    <div>
      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-3">
        {styles.map((style) => (
          <div
            key={style.id}
            onClick={() => onToggle(style.id)}
            className={`relative rounded-lg border-2 overflow-hidden cursor-pointer transition-all ${
              selectedIds.has(style.id)
                ? "border-accent ring-2 ring-accent/30"
                : "border-border hover:border-accent/40"
            }`}
          >
            <img
              src={imgUrl(style)}
              alt={style.name}
              className="w-full aspect-square object-cover"
            />
            <div className="p-2 flex items-center gap-2">
              <input
                type="checkbox"
                checked={selectedIds.has(style.id)}
                onChange={() => onToggle(style.id)}
                onClick={(e) => e.stopPropagation()}
                className="accent-accent"
              />
              <span className="text-xs font-medium truncate flex-1">
                {style.name}
              </span>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  handleDelete(style.id);
                }}
                disabled={deletingId === style.id}
                className="text-xs text-muted hover:text-danger transition-colors disabled:opacity-50"
              >
                {deletingId === style.id ? "..." : "x"}
              </button>
            </div>
          </div>
        ))}

        {/* Add style button / form */}
        {!adding ? (
          <button
            type="button"
            onClick={() => setAdding(true)}
            className="rounded-lg border-2 border-dashed border-border hover:border-accent/50 flex flex-col items-center justify-center aspect-square text-muted hover:text-foreground transition-colors"
          >
            <span className="text-2xl mb-1">+</span>
            <span className="text-xs font-medium">Add Style</span>
          </button>
        ) : (
          <div className="rounded-lg border-2 border-accent/50 p-3 flex flex-col gap-2">
            <input
              type="text"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Style name"
              className="px-2 py-1.5 text-xs border border-border rounded bg-background"
            />
            <input
              ref={fileRef}
              type="file"
              accept="image/*"
              onChange={(e) => setNewFile(e.target.files?.[0] || null)}
              className="text-xs"
            />
            {newFile && (
              <img
                src={URL.createObjectURL(newFile)}
                alt="Preview"
                className="w-full aspect-square object-cover rounded"
              />
            )}
            <div className="flex gap-2">
              <button
                type="button"
                onClick={handleAdd}
                disabled={uploading || !newName.trim() || !newFile}
                className="flex-1 px-2 py-1.5 text-xs font-medium bg-accent text-white rounded hover:opacity-90 disabled:opacity-50"
              >
                {uploading ? "..." : "Save"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setAdding(false);
                  setNewName("");
                  setNewFile(null);
                }}
                className="px-2 py-1.5 text-xs text-muted hover:text-foreground"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>

      {styles.length === 0 && !adding && (
        <p className="text-xs text-muted mt-2">
          No reference styles yet. Add style images that represent the look you
          want for your ads.
        </p>
      )}
    </div>
  );
}
