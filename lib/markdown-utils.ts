// lib/markdown-utils.ts

export type MarkdownSyntax = "bold" | "italic" | "h1" | "h2" | "h3" | "ul" | "ol";

export interface ApplyResult {
  value: string;
  selectionStart: number;
  selectionEnd: number;
}

/**
 * Applies markdown formatting to a textarea's current selection.
 * For inline syntax (bold, italic): wraps selection or inserts placeholder.
 * For block syntax (h1-h3, ul, ol): prefixes each selected line. Toggles off if already present.
 */
export function applyMarkdown(
  textarea: HTMLTextAreaElement,
  syntax: MarkdownSyntax
): ApplyResult {
  const { value, selectionStart, selectionEnd } = textarea;
  const selected = value.slice(selectionStart, selectionEnd);

  // --- Inline: bold / italic ---
  if (syntax === "bold" || syntax === "italic") {
    const marker = syntax === "bold" ? "**" : "*";
    const placeholder = syntax === "bold" ? "bold text" : "italic text";

    if (selected) {
      // Toggle off if already wrapped
      if (
        selected.startsWith(marker) &&
        selected.endsWith(marker) &&
        selected.length > marker.length * 2 &&
        // For italic (*), ensure it's not actually bold (**) wrapped text
        !(marker === "*" && selected.startsWith("**") && selected.endsWith("**"))
      ) {
        const inner = selected.slice(marker.length, -marker.length);
        const newValue =
          value.slice(0, selectionStart) + inner + value.slice(selectionEnd);
        return {
          value: newValue,
          selectionStart,
          selectionEnd: selectionStart + inner.length,
        };
      }
      const wrapped = `${marker}${selected}${marker}`;
      const newValue =
        value.slice(0, selectionStart) + wrapped + value.slice(selectionEnd);
      return {
        value: newValue,
        selectionStart,
        selectionEnd: selectionStart + wrapped.length,
      };
    } else {
      // No selection: insert placeholder, select the placeholder text
      const inserted = `${marker}${placeholder}${marker}`;
      const newValue =
        value.slice(0, selectionStart) + inserted + value.slice(selectionEnd);
      return {
        value: newValue,
        selectionStart: selectionStart + marker.length,
        selectionEnd: selectionStart + marker.length + placeholder.length,
      };
    }
  }

  // --- Block: headings / lists ---
  // Expand selection to cover full lines
  const lineStart = value.lastIndexOf("\n", selectionStart - 1) + 1;
  const lineEndIdx = value.indexOf("\n", selectionEnd);
  const blockEnd = lineEndIdx === -1 ? value.length : lineEndIdx;
  const block = value.slice(lineStart, blockEnd);
  const lines = block.split("\n");

  let newLines: string[];

  if (syntax === "h1" || syntax === "h2" || syntax === "h3") {
    const prefix = syntax === "h1" ? "# " : syntax === "h2" ? "## " : "### ";
    const allHave = lines.every((l) => l.startsWith(prefix));
    newLines = allHave
      ? lines.map((l) => l.slice(prefix.length))
      : lines.map((l) => (l.startsWith(prefix) ? l : prefix + l));
  } else if (syntax === "ul") {
    const allHave = lines.every((l) => l.startsWith("- "));
    newLines = allHave
      ? lines.map((l) => l.slice(2))
      : lines.map((l) => (l.startsWith("- ") ? l : `- ${l}`));
  } else {
    // ol
    const olRegex = /^\d+\. /;
    const allHave = lines.every((l) => olRegex.test(l));
    newLines = allHave
      ? lines.map((l) => l.replace(olRegex, ""))
      : lines.map((l, i) => `${i + 1}. ${l.replace(olRegex, "")}`);
  }

  const newBlock = newLines.join("\n");
  const newValue = value.slice(0, lineStart) + newBlock + value.slice(blockEnd);
  const lengthDiff = newBlock.length - block.length;

  return {
    value: newValue,
    selectionStart: lineStart,
    selectionEnd: blockEnd + lengthDiff,
  };
}

/**
 * Strips markdown syntax characters before Flesch-Kincaid scoring
 * so asterisks and prefixes don't inflate syllable counts.
 */
export function stripMarkdownForFK(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1") // **bold**
    .replace(/\*(.+?)\*/g, "$1")      // *italic*
    .replace(/^#{1,6} /gm, "")        // # headings
    .replace(/^- /gm, "")             // - bullets
    .replace(/^\d+\. /gm, "")         // 1. numbered lists
    .replace(/\*+/g, "");             // orphaned asterisks from multiline spans
}
