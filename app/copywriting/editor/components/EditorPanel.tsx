"use client";

import { getFKLevel, type FKResult } from "@/lib/flesch-kincaid";

interface EditorPanelProps {
  title: string;
  onTitleChange: (title: string) => void;
  content: string;
  onContentChange: (content: string) => void;
  fk: FKResult;
  saveStatus: "idle" | "saving" | "saved" | "error";
  onSave: () => void;
  textareaRef?: React.RefObject<HTMLTextAreaElement | null>;
}

export default function EditorPanel({
  title,
  onTitleChange,
  content,
  onContentChange,
  fk,
  saveStatus,
  onSave,
  textareaRef,
}: EditorPanelProps) {
  const fkLevel = getFKLevel(fk.gradeLevel);
  const fkColor =
    fkLevel === "green"
      ? "text-success bg-green-50 border-success"
      : fkLevel === "yellow"
        ? "text-amber-600 bg-amber-50 border-amber-400"
        : "text-danger bg-red-50 border-danger";

  return (
    <div className="flex flex-col h-full">
      <input
        type="text"
        value={title}
        onChange={(e) => onTitleChange(e.target.value)}
        placeholder="Wine name (e.g. 2021 Duckhorn Napa Valley Merlot)"
        className="w-full px-4 py-3 border border-border rounded-xl bg-surface text-lg font-medium focus:outline-none focus:border-accent transition-colors mb-3"
      />

      <textarea
        ref={textareaRef}
        value={content}
        onChange={(e) => onContentChange(e.target.value)}
        placeholder="Start writing your wine write-up here..."
        className="flex-1 w-full min-h-[400px] px-4 py-3 border border-border rounded-xl bg-surface text-sm leading-relaxed resize-y focus:outline-none focus:border-accent transition-colors"
      />

      {/* Footer: FK badge + word count + save */}
      <div className="flex items-center justify-between mt-3">
        <div className="flex items-center gap-3">
          {fk.words > 0 && (
            <>
              <span className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${fkColor}`}>
                FK {fk.gradeLevel}
              </span>
              <span className="text-xs text-muted">
                {fk.words} words &middot; {fk.sentences} sentences
              </span>
            </>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onSave}
            disabled={!content.trim()}
            className="px-4 py-2 text-sm bg-accent text-white rounded-lg hover:bg-accent/90 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
          >
            {saveStatus === "saving"
              ? "Saving..."
              : saveStatus === "saved"
                ? "Saved!"
                : saveStatus === "error"
                  ? "Save Failed"
                  : "Save"}
          </button>
        </div>
      </div>
    </div>
  );
}
