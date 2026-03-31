import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import fs from "fs";
import path from "path";
import { getBrandContextDir } from "@/lib/brands";

const anthropic = new Anthropic();

const projectRoot = process.cwd();

function readFile(filePath: string): string {
  if (!fs.existsSync(filePath)) return "";
  return fs.readFileSync(filePath, "utf-8").trim();
}

/** Load only the context needed for critique: voice + wine copy guidance */
function loadCritiqueContext(brandId: string): string {
  const dir = getBrandContextDir(brandId);
  const voice = readFile(path.join(dir, "voice-guidelines.md"));
  const wineCopyGuidance = readFile(path.join(dir, "wine-copy-guidance.md"));

  const sections: string[] = [];
  if (voice) sections.push(`## Brand Voice\n\n${voice}`);
  if (wineCopyGuidance) sections.push(`## Wine Copy Guidance\n\n${wineCopyGuidance}`);
  return sections.join("\n\n---\n\n");
}

/** Load the LBW swipe file — fundamentals and technique breakdowns */
function loadSwipeFile(): string {
  const swipePath = path.join(
    projectRoot,
    "knowledge/competitor-intel/last-bottle/swipe-file.md"
  );
  return readFile(swipePath);
}

function buildSystemPrompt(critiqueContext: string, swipeFile: string): string {
  return `You are a senior wine copy editor and critique engine for Wine Spies.

## 8-Element Evaluation Rubric
Score each 1–5:
1. **Price arrives within first 3 sentences** — The deal is the story. Price should land early.
2. **Flavor copy uses concrete/physical language** — No "hints of minerality." Use images people can taste.
3. **Score is contextualized, not just stated** — Don't just say "94 points." Say why that matters.
4. **CTA has friction-minimizing element** — Time estimate, ease signal, or specific action.
5. **Producer story has a non-wine surprise** — One detail that makes them a character, not a credential.
6. **Subject line leads with score or price** — Never the producer name. Score or price first.
7. **Narrator voice appears at least once** — The Spy should show up as a character in the copy.
8. **Scarcity signal in body AND close** — Production numbers, allocation limits, or time pressure.

${critiqueContext}

## Reference Benchmark: Last Bottle Wines
Use this as the gold standard for wine deal copy. Wine Spies should match this quality while maintaining its own voice (sharper, more coded, less confessional than LBW).

${swipeFile}`;
}

const STAGE_PROMPTS: Record<number, string> = {
  1: `STAGE 1 — REDLINES

Perform a line-by-line critique of this wine write-up draft.

For each issue found, output in this format:
LINE: [quote the specific text]
ISSUE: [what's wrong]
FIX: [specific suggestion]

After all redlines, report:
- Estimated Flesch-Kincaid Grade Level
- Total word count
- Overall energy level (1-10)
- Biggest structural weakness

Be direct. Be specific. No pleasantries.`,

  2: `STAGE 2 — RUBRIC SCORING + TOP 3 FIXES

Score this draft against all 8 rubric elements (1-5 each). Use this format:

| Element | Score | Note |
|---------|-------|------|
| 1. Price arrives within first 3 sentences | X/5 | [brief note] |
| 2. Flavor copy uses concrete/physical language | X/5 | [brief note] |
| 3. Score is contextualized, not just stated | X/5 | [brief note] |
| 4. CTA has friction-minimizing element | X/5 | [brief note] |
| 5. Producer story has a non-wine surprise | X/5 | [brief note] |
| 6. Subject line leads with score or price | X/5 | [brief note] |
| 7. Narrator voice appears at least once | X/5 | [brief note] |
| 8. Scarcity signal in body AND close | X/5 | [brief note] |

**Total: XX/40**

Then list the **TOP 3 highest-leverage fixes** ranked by impact on the overall piece. For each:
1. What to fix
2. Why it matters most
3. Specific rewrite suggestion for that section`,

  3: `STAGE 3 — FULL REWRITE

Rewrite this draft from scratch, applying all feedback from the previous stages.

Rules:
- Preserve all wine facts (producer, region, varietal, score, price, tasting notes)
- Target FK Grade Level 5–7
- Include a subject line
- Write in Wine Spies voice (The Spy character — wry, coded, sharp)
- Apply all 8 rubric elements
- "Same writer, better day" feel — this should read like the author's best version, not a different person
- Include scarcity close

Output the rewrite only. No commentary before or after.`,
};

const STRUCTURED_CRITIQUE_PROMPT = `Perform a structured critique of this wine write-up draft. Return ONLY valid JSON (no code fences, no commentary) in this exact format:

{
  "rubricScores": [
    { "element": "Price arrives within first 3 sentences", "score": <1-5>, "note": "<brief note>" },
    { "element": "Flavor copy uses concrete/physical language", "score": <1-5>, "note": "<brief note>" },
    { "element": "Score is contextualized, not just stated", "score": <1-5>, "note": "<brief note>" },
    { "element": "CTA has friction-minimizing element", "score": <1-5>, "note": "<brief note>" },
    { "element": "Producer story has a non-wine surprise", "score": <1-5>, "note": "<brief note>" },
    { "element": "Subject line leads with score or price", "score": <1-5>, "note": "<brief note>" },
    { "element": "Narrator voice appears at least once", "score": <1-5>, "note": "<brief note>" },
    { "element": "Scarcity signal in body AND close", "score": <1-5>, "note": "<brief note>" }
  ],
  "totalScore": <raw total out of 40>,
  "overallScore": <mapped 0-100>,
  "items": [
    {
      "id": "<unique-id>",
      "line": "<exact quoted text from draft>",
      "issue": "<what's wrong>",
      "fix": "<drop-in replacement text>",
      "severity": "high" | "medium" | "low"
    }
  ],
  "fkEstimate": <number>,
  "wordCount": <number>,
  "energyLevel": <1-10>,
  "biggestWeakness": "<one sentence>"
}

Rules:
- "line" must be an EXACT substring from the draft so it can be found with string matching
- "fix" must be a drop-in replacement for "line"
- Include 4-10 items, ordered by severity (high first)
- Each item id should be "item-1", "item-2", etc.
- overallScore = Math.round((totalScore / 40) * 100)
- Return ONLY the JSON object, nothing else`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { brand = "winespies", draft, stage, stage1Output, stage2Output } = body;

    if (!draft) {
      return NextResponse.json(
        { error: "draft is required" },
        { status: 400 }
      );
    }

    const critiqueContext = loadCritiqueContext(brand);
    const swipeFile = loadSwipeFile();
    const systemPrompt = buildSystemPrompt(critiqueContext, swipeFile);

    // New structured path: when stage is not provided
    if (!stage) {
      const userPrompt = `Here is the wine write-up draft to critique:\n\n---\n${draft}\n---\n\n${STRUCTURED_CRITIQUE_PROMPT}`;

      const response = await anthropic.messages.create({
        model: "claude-sonnet-4-5",
        max_tokens: 3000,
        system: systemPrompt,
        messages: [{ role: "user", content: userPrompt }],
      });

      const text =
        response.content[0].type === "text" ? response.content[0].text : "";

      // Strip code fences if present
      const cleaned = text.replace(/^```(?:json)?\s*\n?/i, "").replace(/\n?```\s*$/i, "").trim();

      try {
        const parsed = JSON.parse(cleaned);
        return NextResponse.json(parsed);
      } catch {
        // Fallback: return raw output so UI can degrade gracefully
        return NextResponse.json({ fallback: true, rawOutput: text });
      }
    }

    // Legacy stage-based path
    if (![1, 2, 3].includes(stage)) {
      return NextResponse.json(
        { error: "stage must be 1, 2, or 3" },
        { status: 400 }
      );
    }

    let userPrompt = `Here is the wine write-up draft to critique:\n\n---\n${draft}\n---\n\n${STAGE_PROMPTS[stage]}`;

    if (stage === 2 && stage1Output) {
      userPrompt += `\n\n## Previous Stage 1 Redlines (for reference):\n${stage1Output}`;
    }
    if (stage === 3) {
      if (stage1Output) {
        userPrompt += `\n\n## Stage 1 Redlines:\n${stage1Output}`;
      }
      if (stage2Output) {
        userPrompt += `\n\n## Stage 2 Rubric Scoring:\n${stage2Output}`;
      }
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    return NextResponse.json({ stage, output: text });
  } catch (err: unknown) {
    console.error("Critique API error:", err);
    const isRateLimit =
      (err instanceof Error && err.message.includes("rate_limit")) ||
      (typeof err === "object" && err !== null && "status" in err && (err as { status: number }).status === 429);
    if (isRateLimit) {
      return NextResponse.json(
        { error: "Rate limit hit — wait 30-60 seconds and retry.", retryable: true },
        { status: 429 }
      );
    }
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
