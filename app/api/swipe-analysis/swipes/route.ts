import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const SWIPE_FILE_PATH = path.join(process.cwd(), "docs/last-bottle-swipe-file.md");

export interface ParsedSwipe {
  id: string;
  title: string;
  category: string;
  swipe: string;
  why: string;
  remixPrompt: string;
}

/**
 * Parse the swipe file markdown into structured swipe objects.
 * Looks for ### SWIPE X-Y patterns and extracts quote, why, and remix prompt.
 */
function parseSwipeFile(): ParsedSwipe[] {
  if (!fs.existsSync(SWIPE_FILE_PATH)) return [];
  const raw = fs.readFileSync(SWIPE_FILE_PATH, "utf-8");

  const swipes: ParsedSwipe[] = [];
  let currentCategory = "";

  // Split by ### SWIPE or ### Swipe headers
  const sections = raw.split(/^###\s+(?:SWIPE\s+)?/im);

  // Track current technique/category from ## headers
  const lines = raw.split("\n");
  const categoryMap = new Map<number, string>();
  for (let i = 0; i < lines.length; i++) {
    const match = lines[i].match(/^##\s+(?:TECHNIQUE\s+\d+:\s*)?(.+)/i);
    if (match) {
      categoryMap.set(i, match[1].trim());
    }
  }

  // Process each swipe section
  for (let i = 1; i < sections.length; i++) {
    const section = sections[i];
    const titleLine = section.split("\n")[0].trim();

    // Find which category this swipe belongs to by checking what ## header precedes it
    const sectionStart = raw.indexOf(sections[i]);
    const textBefore = raw.slice(0, sectionStart);
    const linesBefore = textBefore.split("\n").length;

    for (const [lineNum, cat] of categoryMap) {
      if (lineNum < linesBefore) currentCategory = cat;
    }

    // Extract the swipe quote (blockquote)
    const quoteMatch = section.match(/>\s*"?([^]*?)"?\s*\n\s*\n/);
    const swipeText = quoteMatch
      ? quoteMatch[1].replace(/^>\s*/gm, "").replace(/^"|"$/g, "").trim()
      : "";

    // Extract "Why it works"
    const whyMatch = section.match(
      /\*\*Why it works:?\*\*\s*([^]*?)(?=\n\s*\*\*Remix prompt|---|\n##|$)/i
    );
    const whyText = whyMatch ? whyMatch[1].trim() : "";

    // Extract remix prompt (blockquote after "Remix prompt")
    const remixMatch = section.match(
      /\*\*Remix prompt:?\*\*\s*\n>\s*([^]*?)(?=\n\s*---|\n##|$)/i
    );
    const remixText = remixMatch
      ? remixMatch[1].replace(/^>\s*/gm, "").trim()
      : "";

    if (swipeText || whyText) {
      // Clean up the title: remove "SWIPE X-Y:" prefix and trailing formatting
      const cleanTitle = titleLine
        .replace(/^(?:SWIPE\s+)?[\dA-Z]+-[A-Z]:\s*/i, "")
        .replace(/\s*\*+\s*$/, "")
        .trim();

      swipes.push({
        id: `swipe-${i}`,
        title: cleanTitle || `Swipe ${i}`,
        category: currentCategory || "Uncategorized",
        swipe: swipeText,
        why: whyText,
        remixPrompt: remixText,
      });
    }
  }

  return swipes;
}

export async function GET() {
  const swipes = parseSwipeFile();

  // Get unique categories
  const categories = [...new Set(swipes.map((s) => s.category))];

  return NextResponse.json({ swipes, categories, total: swipes.length });
}
