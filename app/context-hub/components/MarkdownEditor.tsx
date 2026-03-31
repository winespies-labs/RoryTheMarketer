"use client";

import { useCallback, useEffect, useRef, useState } from "react";

const BRAND_ID = "winespies";

interface MarkdownEditorProps {
  sectionId: string;
  label: string;
  onSaved?: () => void;
}

export default function MarkdownEditor({ sectionId, label, onSaved }: MarkdownEditorProps) {
  const [content, setContent] = useState("");
  const [savedContent, setSavedContent] = useState("");
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveMsg, setSaveMsg] = useState("");
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const isDirty = content !== savedContent;

  const fetchContent = useCallback(() => {
    setLoading(true);
    fetch(`/api/context/section?brand=${BRAND_ID}&section=${sectionId}`)
      .then((r) => r.json())
      .then((d) => {
        setContent(d.content ?? "");
        setSavedContent(d.content ?? "");
      })
      .catch(() => {
        setContent("");
        setSavedContent("");
      })
      .finally(() => setLoading(false));
  }, [sectionId]);

  useEffect(() => {
    fetchContent();
  }, [fetchContent]);

  const handleSave = async () => {
    setSaving(true);
    setSaveMsg("");
    try {
      const res = await fetch("/api/context/section", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand: BRAND_ID, section: sectionId, content }),
      });
      if (res.ok) {
        setSavedContent(content);
        setSaveMsg("Saved");
        onSaved?.();
        setTimeout(() => setSaveMsg(""), 2000);
      } else {
        setSaveMsg("Save failed");
      }
    } catch {
      setSaveMsg("Save failed");
    } finally {
      setSaving(false);
    }
  };

  // Auto-resize textarea
  useEffect(() => {
    const ta = textareaRef.current;
    if (ta) {
      ta.style.height = "auto";
      ta.style.height = Math.max(300, ta.scrollHeight) + "px";
    }
  }, [content, loading]);

  if (loading) {
    return <div className="text-muted text-sm py-8 text-center">Loading {label}...</div>;
  }

  return (
    <div>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-lg font-semibold">{label}</h2>
        <div className="flex items-center gap-3">
          {saveMsg && (
            <span className={`text-xs ${saveMsg === "Saved" ? "text-success" : "text-danger"}`}>
              {saveMsg}
            </span>
          )}
          <button
            onClick={handleSave}
            disabled={!isDirty || saving}
            className="px-4 py-1.5 text-sm font-medium bg-accent text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-40"
          >
            {saving ? "Saving..." : "Save"}
          </button>
        </div>
      </div>

      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => setContent(e.target.value)}
        className="w-full px-4 py-3 text-sm font-mono border border-border rounded-lg bg-background resize-y leading-relaxed focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
        placeholder={`Enter ${label.toLowerCase()} content...`}
      />

      {isDirty && (
        <p className="text-xs text-muted mt-2">You have unsaved changes.</p>
      )}
    </div>
  );
}
