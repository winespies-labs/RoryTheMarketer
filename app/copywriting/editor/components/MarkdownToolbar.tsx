// app/copywriting/editor/components/MarkdownToolbar.tsx
"use client";

import { type RefObject } from "react";
import { applyMarkdown, type MarkdownSyntax } from "@/lib/markdown-utils";

interface MarkdownToolbarProps {
  textareaRef: RefObject<HTMLTextAreaElement | null>;
  onChange: (value: string) => void;
}

interface ButtonDef {
  label: string;
  syntax: MarkdownSyntax;
  title: string;
  className?: string;
  separatorAfter?: boolean;
}

const BUTTONS: ButtonDef[] = [
  { label: "B", syntax: "bold", title: "Bold (⌘B)", className: "font-bold" },
  { label: "I", syntax: "italic", title: "Italic (⌘I)", className: "italic", separatorAfter: true },
  { label: "H1", syntax: "h1", title: "Heading 1" },
  { label: "H2", syntax: "h2", title: "Heading 2" },
  { label: "H3", syntax: "h3", title: "Heading 3", separatorAfter: true },
  { label: "•", syntax: "ul", title: "Bullet list" },
  { label: "1.", syntax: "ol", title: "Numbered list" },
];

export default function MarkdownToolbar({ textareaRef, onChange }: MarkdownToolbarProps) {
  function handleAction(syntax: MarkdownSyntax) {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const result = applyMarkdown(textarea, syntax);
    onChange(result.value);
    // Restore focus and cursor after React re-render
    requestAnimationFrame(() => {
      textarea.focus();
      textarea.setSelectionRange(result.selectionStart, result.selectionEnd);
    });
  }

  return (
    <div className="flex items-center gap-0.5 px-1.5 py-1 border border-border rounded-lg bg-surface mb-1.5">
      {BUTTONS.map(({ label, syntax, title, className, separatorAfter }) => (
        <span key={syntax} className="contents">
          <button
            type="button"
            title={title}
            onMouseDown={(e) => {
              e.preventDefault(); // Prevent textarea blur before action fires
              handleAction(syntax);
            }}
            className={`px-2 py-0.5 text-xs rounded text-foreground hover:bg-accent/10 hover:text-accent transition-colors ${className ?? ""}`}
          >
            {label}
          </button>
          {separatorAfter && (
            <span className="w-px h-4 bg-border mx-0.5 self-center" />
          )}
        </span>
      ))}
    </div>
  );
}
