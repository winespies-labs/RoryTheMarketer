import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";

const anthropic = new Anthropic();

const SWIPE_FILE_PATH = path.join(process.cwd(), "docs/last-bottle-swipe-file.md");
const KNOWLEDGE_COPY_PATH = path.join(
  process.cwd(),
  "knowledge/competitor-intel/last-bottle/swipe-file.md"
);
const CORPUS_PATH = path.join(
  process.cwd(),
  "knowledge/competitor-intel/last-bottle/lbw-email-corpus.md"
);

function readSwipeFile(): string {
  if (!fs.existsSync(SWIPE_FILE_PATH)) return "";
  return fs.readFileSync(SWIPE_FILE_PATH, "utf-8");
}

function syncToKnowledge(): void {
  const content = fs.readFileSync(SWIPE_FILE_PATH, "utf-8");
  const knowledgeDir = path.dirname(KNOWLEDGE_COPY_PATH);
  if (!fs.existsSync(knowledgeDir)) {
    fs.mkdirSync(knowledgeDir, { recursive: true });
  }
  fs.writeFileSync(KNOWLEDGE_COPY_PATH, content, "utf-8");
}

/** Parse the corpus file into individual emails */
function parseCorpus(): { id: string; subject: string; content: string }[] {
  if (!fs.existsSync(CORPUS_PATH)) return [];
  const raw = fs.readFileSync(CORPUS_PATH, "utf-8");
  const emailBlocks = raw.split(/^## EMAIL \d+/m).slice(1); // skip header
  return emailBlocks.map((block, i) => {
    const lines = block.trim().split("\n");
    const subjectLine = lines.find((l) => l.startsWith("**Subject:**"));
    const subject = subjectLine?.replace("**Subject:**", "").trim() || `Email ${i + 1}`;
    const id = String(i + 1).padStart(3, "0");
    return { id, subject, content: block.trim() };
  });
}

const SYSTEM_PROMPT = `You are a copy analyst specializing in wine deal email marketing. You analyze raw email copy from Last Bottle Wines and break it down into categorized technique swipes.

## Technique Categories
1. **PRICE ANCHORING** — How price is framed, repeated, compared, or emotionally charged
2. **URGENCY AND SCARCITY** — Production numbers, time limits, effort signals, closing pressure
3. **FLAVOR AND SENSORY COPY** — Tasting notes written as sensation, not description
4. **CREDENTIAL AND AUTHORITY DROPS** — Scores, winemaker bios, critic quotes delivered as story
5. **LEAD HOOKS AND EMAIL OPENS** — How the email opens before the wine appears
6. **PRODUCER STORYTELLING** — Producer/winemaker story as entertainment, not biography
7. **SUBJECT LINES** — Subject line structure and voice devices

## Output Format

For EACH distinct technique moment you identify in the copy, output a swipe entry in this EXACT markdown format:

### SWIPE X-Y: [Short Descriptive Title]
> "[Exact quote from the email — the swipe itself]"

**Why it works:** [2-4 sentences analyzing the specific craft moves. What makes this effective? What structural, tonal, or psychological technique is at play? Be specific about the copywriting mechanics, not vague praise.]

**Remix prompt:**
> [A prompt that tells a Wine Spies copywriter how to replicate this technique for their own wine. Include the structural pattern to follow and any constraints (sentence count, what to include/exclude).]

---

## Rules
- Extract ONLY moments that demonstrate genuine craft — skip generic or unremarkable passages
- One email might contain 3-8 technique moments across different categories
- Group your output by technique category (use the ## TECHNIQUE headers)
- The "Why it works" should teach — explain the MECHANISM, not just say "it's effective"
- The remix prompt should be actionable and specific to Wine Spies voice
- Quote the source text exactly — don't paraphrase the swipe
- If a moment could fit multiple categories, put it in the one where the technique is MOST prominent
- Number swipes sequentially within each category (e.g., if PRICE ANCHORING already has 1-A through 1-C, start new ones at 1-D)
- Be selective — pull the 3-6 BEST technique moments per email, not every sentence`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { copy, corpusEmailIds } = body;

    // Determine input: pasted copy OR corpus email IDs
    let inputCopy = "";

    if (corpusEmailIds?.length) {
      const emails = parseCorpus();
      const selected = emails.filter((e) => corpusEmailIds.includes(e.id));
      if (selected.length === 0) {
        return NextResponse.json({ error: "No matching emails found in corpus" }, { status: 400 });
      }
      inputCopy = selected.map((e) => `## EMAIL ${e.id}\n${e.content}`).join("\n\n---\n\n");
    } else if (copy?.trim()) {
      inputCopy = copy.trim();
    } else {
      return NextResponse.json(
        { error: "Provide either 'copy' (pasted text) or 'corpusEmailIds' (array of IDs)" },
        { status: 400 }
      );
    }

    const existingSwipeFile = readSwipeFile();

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 8000,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Here is the EXISTING swipe file (so you know what's already documented and can continue numbering from where it left off):

---EXISTING FILE---
${existingSwipeFile}
---END EXISTING FILE---

Now analyze this Last Bottle Wines email copy and extract the best technique swipes:

---COPY TO ANALYZE---
${inputCopy}
---END COPY---

Output only the new swipe entries grouped by technique category. Use the ## TECHNIQUE headers. Continue numbering from where the existing file left off within each category.`,
        },
      ],
    });

    const analysisText =
      response.content[0].type === "text" ? response.content[0].text : "";

    if (!analysisText.trim()) {
      return NextResponse.json(
        { error: "Analysis returned empty — try with different copy" },
        { status: 500 }
      );
    }

    // Append to the swipe file
    const separator =
      "\n\n---\n\n## NEW SWIPES ADDED " +
      new Date().toISOString().split("T")[0] +
      "\n\n";
    fs.appendFileSync(SWIPE_FILE_PATH, separator + analysisText + "\n", "utf-8");

    // Sync to knowledge directory
    syncToKnowledge();

    return NextResponse.json({
      ok: true,
      entriesAdded: analysisText,
      message:
        "Analysis appended to docs/last-bottle-swipe-file.md and synced to knowledge/",
    });
  } catch (err: unknown) {
    console.error("Swipe analysis error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
