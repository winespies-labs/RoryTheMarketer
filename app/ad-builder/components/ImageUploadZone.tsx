"use client";

import { useRef, useState, useCallback } from "react";

interface ImageUploadZoneProps {
  label: string;
  accept?: string;
  onFileSelect: (file: File) => void;
  previewUrl?: string;
  onClear: () => void;
  compact?: boolean;
}

export default function ImageUploadZone({
  label,
  accept = "image/*",
  onFileSelect,
  previewUrl,
  onClear,
  compact = false,
}: ImageUploadZoneProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = useCallback(
    (file: File) => {
      if (file.type.startsWith("image/")) {
        onFileSelect(file);
      }
    },
    [onFileSelect]
  );

  const handleDrop = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      setDragOver(false);
      const file = e.dataTransfer.files[0];
      if (file) handleFile(file);
    },
    [handleFile]
  );

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) handleFile(file);
    // Reset input so same file can be re-selected
    e.target.value = "";
  };

  if (compact && !previewUrl) {
    return (
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragOver(true);
        }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
        onClick={() => inputRef.current?.click()}
        className={`w-24 h-24 rounded-lg border-2 border-dashed flex items-center justify-center cursor-pointer transition-colors ${
          dragOver
            ? "border-accent bg-accent-light"
            : "border-border hover:border-accent/50 bg-background"
        }`}
      >
        <input
          ref={inputRef}
          type="file"
          accept={accept}
          onChange={handleChange}
          className="hidden"
        />
        <span className="text-2xl text-muted">+</span>
      </div>
    );
  }

  if (previewUrl) {
    return (
      <div className="relative rounded-lg border border-border bg-background overflow-hidden">
        <div className="p-2">
          <p className="text-xs font-medium text-muted mb-2">{label}</p>
          <img
            src={previewUrl}
            alt={label}
            className="w-full h-40 object-contain rounded"
          />
        </div>
        <button
          type="button"
          onClick={onClear}
          className="absolute top-2 right-2 w-6 h-6 flex items-center justify-center rounded-full bg-surface border border-border text-muted hover:text-foreground text-xs"
        >
          x
        </button>
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setDragOver(true);
      }}
      onDragLeave={() => setDragOver(false)}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
      className={`rounded-lg border-2 border-dashed p-6 text-center cursor-pointer transition-colors ${
        dragOver
          ? "border-accent bg-accent-light"
          : "border-border hover:border-accent/50 bg-background"
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept={accept}
        onChange={handleChange}
        className="hidden"
      />
      <p className="text-sm font-medium text-foreground mb-1">{label}</p>
      <p className="text-xs text-muted">
        Drag & drop or click to upload
      </p>
    </div>
  );
}
