import { makePrimaryAndLeafTags } from "@/lib/swipe-tagging";

export type SwipeMarkdownParsedItem = {
  title: string;
  content: string;
  tags: string[];
};

/** Strip markdown bold/italic markers for cleaner stored content */
function stripInlineMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/__(.+?)__/g, "$1")
    .replace(/_(.+?)_/g, "$1");
}

/**
 * Parses markdown shaped like:
 * - ## 1. SOME SECTION
 * - ### Subheading / Pattern
 * - - "Swipe copy quote..."
 * - | Col1 | Col2 | (table rows)
 * - > "Blockquote copy..."
 *
 * Each bullet, table data row, or blockquote block becomes one parsed item.
 */
export function parseSwipeMarkdownToItems(markdown: string): SwipeMarkdownParsedItem[] {
  const lines = markdown.split(/\r?\n/);

  let currentSectionHeading = "";
  let currentSubHeading = "";

  let collectingBullet = false;
  let bulletBuffer = "";

  let collectingBlockquote = false;
  let blockquoteBuffer = "";

  // Track table header columns for context (e.g. "Word/Phrase | Vibe")
  let tableHeaders: string[] = [];
  let inTable = false;

  const items: SwipeMarkdownParsedItem[] = [];

  const pushItem = (content: string) => {
    if (!content || !currentSectionHeading.trim()) return;

    const title = currentSubHeading.trim() || currentSectionHeading.trim();
    const { tags } = makePrimaryAndLeafTags({
      sectionHeading: currentSectionHeading.trim(),
      subHeading: currentSubHeading.trim() || undefined,
    });

    items.push({ title, content: stripInlineMarkdown(content), tags });
  };

  const finalizeBullet = () => {
    if (!collectingBullet) return;
    const content = bulletBuffer.trim();
    collectingBullet = false;
    bulletBuffer = "";
    pushItem(content);
  };

  const finalizeBlockquote = () => {
    if (!collectingBlockquote) return;
    const content = blockquoteBuffer.trim();
    collectingBlockquote = false;
    blockquoteBuffer = "";
    pushItem(content);
  };

  const finalizeAll = () => {
    finalizeBullet();
    finalizeBlockquote();
  };

  for (const rawLine of lines) {
    const line = rawLine.trimEnd();

    // --- Section headings (## 1. TITLE) ---
    const sectionMatch = line.match(/^##\s*\d+\.\s*(.+)$/);
    if (sectionMatch) {
      finalizeAll();
      inTable = false;
      tableHeaders = [];
      currentSectionHeading = sectionMatch[1].trim();
      currentSubHeading = "";
      continue;
    }

    const subHeadingMatch = line.match(/^###\s*(.+)$/);
    if (subHeadingMatch) {
      finalizeAll();
      inTable = false;
      tableHeaders = [];
      currentSubHeading = subHeadingMatch[1].trim();
      continue;
    }

    // --- Table rows ---
    const tableRowMatch = line.match(/^\|(.+)\|$/);
    if (tableRowMatch) {
      finalizeAll();
      const cells = tableRowMatch[1].split("|").map((c) => c.trim());

      // Separator row (e.g. |---|---|)
      if (cells.every((c) => /^[-:\s]+$/.test(c))) {
        inTable = true;
        continue;
      }

      // Header row (first row before separator)
      if (!inTable) {
        tableHeaders = cells;
        inTable = false; // will be set true after separator
        continue;
      }

      // Data row — combine cells into content
      if (inTable && cells.length >= 1 && cells[0]) {
        let content = cells[0];
        // If there's a second column (like "Vibe"), append as parenthetical context
        if (cells.length >= 2 && cells[1]) {
          content += ` (${cells[1]})`;
        }
        pushItem(content);
      }
      continue;
    }

    // If we were in a table but hit a non-table line, exit table mode
    if (inTable && !tableRowMatch) {
      inTable = false;
      tableHeaders = [];
    }

    // --- Blockquotes ---
    const blockquoteMatch = line.match(/^>\s?(.*)$/);
    if (blockquoteMatch) {
      finalizeBullet();
      if (!collectingBlockquote) {
        collectingBlockquote = true;
        blockquoteBuffer = blockquoteMatch[1] ?? "";
      } else {
        const addition = blockquoteMatch[1] ?? "";
        blockquoteBuffer += addition ? `\n${addition}` : "";
      }
      continue;
    }

    // If we were collecting a blockquote and hit a non-blockquote line
    if (collectingBlockquote && !line.match(/^>\s?/)) {
      // Blank line or heading ends the blockquote
      if (!line.trim() || line.trimStart().startsWith("#")) {
        finalizeBlockquote();
        // Don't continue — let heading/blank logic below handle it
        if (line.trim() && line.trimStart().startsWith("#")) {
          // re-check heading (won't match since we already checked above)
        }
        if (!line.trim()) continue;
      } else {
        // Continuation text under a blockquote? Finalize what we have.
        finalizeBlockquote();
      }
    }

    // --- Bullet points ---
    const bulletMatch = line.match(/^\s*-\s+(.*)$/);
    if (bulletMatch) {
      finalizeBullet();
      collectingBullet = true;
      bulletBuffer = bulletMatch[1] ?? "";
      continue;
    }

    if (collectingBullet) {
      if (!line.trim()) {
        finalizeBullet();
        continue;
      }
      if (line.trimStart().startsWith("#")) {
        finalizeBullet();
        continue;
      }
      // Wrapped continuation line
      bulletBuffer += `\n${line.trim()}`;
    }
  }

  finalizeAll();

  return items;
}

