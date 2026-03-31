# Build Spec: Copy Training & Critique Tools
**For:** Rory Creative Ops (rorythemarketer-production.up.railway.app)  
**Hand to:** Claude Code  
**Scope:** Two new tools — Copy Drill (training) and Copy Critique (improvement)

---

## CONTEXT

We are adding two copywriting tools to the existing Rory Next.js app:

1. **Copy Drill** — a self-directed training tool. Teaches copywriting techniques through 4-step drills: read a swipe → study why it works → write your own version → compare to an example. Lives under the Copywriting section.

2. **Copy Critique** — a 3-stage AI-powered critique flow. User pastes a Wine Spies or Archival writeup, gets: line-by-line redlines → scored rubric + top 3 fixes → full rewrite. Also lives under the Copywriting section.

---

## PART 1: COPY DRILL

### Route
Add to the Copywriting section nav. Route: `/copywriting/drill`

### Component
A complete working React component is provided in the file `copy-drill.jsx` at the root of this spec. Drop it in as-is at `app/copywriting/drill/page.jsx` (or equivalent based on your routing structure). It is fully self-contained — no API calls, no external dependencies beyond React.

### What the component does
- 7 technique categories (Price Anchoring, Urgency/Scarcity, Flavor Copy, Credentials, Lead Hooks, Subject Lines, Producer Storytelling)
- 14 individual drills, each with: a verbatim swipe, mechanism label, craft annotation, writing prompt, and example
- 4-step flow per drill: Swipe → Why It Works → Your Turn → Example
- The example is hidden until the user clicks "Reveal" — they must write something first
- Progress dots in the header track position in the drill
- Dark editorial aesthetic — do not restyle, it is intentional

### Nav integration
Add "Copy Drill" as a nav item in the Copywriting section. It should sit alongside whatever other Copywriting tools currently exist.

### Data file (optional refactor)
If you prefer to keep the drill data separate from the component, extract the `TECHNIQUES` array from the component into `/data/copy-drills.js` and import it. The structure is:

```js
{
  id: string,
  label: string,
  icon: string,
  description: string,
  swipes: [
    {
      id: string,
      title: string,
      swipe: string,       // the verbatim copy example
      why: string,         // craft annotation
      mechanism: string,   // one-line structural label
      prompt: string,      // writing prompt for the user
      example: string,     // example version to reveal at end
    }
  ]
}
```

---

## PART 2: COPY CRITIQUE

### Route
`/copywriting/critique`

### What it does
The user pastes a Wine Spies or Archival product writeup. The tool runs it through a 3-stage AI critique in sequence, one stage at a time, each requiring a user action to advance.

**Stage 1 — Redlines**  
Line-by-line annotations on the draft. Each annotation flags a specific sentence or phrase and explains what to improve and why. Format: the original line, the issue, a suggested fix.

**Stage 2 — Rubric + Top 3**  
Score the draft against an 8-element rubric (see below). Then surface the top 3 highest-leverage fixes — the things that would most improve the copy if changed.

**Stage 3 — Rewrite**  
A full rewrite of the draft applying all the feedback from stages 1 and 2. Should preserve the wine's facts and voice but upgrade the mechanics.

### UI flow
```
[Paste draft] → [Run Critique] →
  Stage 1 result displayed → [Continue to Rubric] →
  Stage 2 result displayed → [Generate Rewrite] →
  Stage 3 result displayed → [Copy / Start Over]
```

Show a progress indicator (e.g. Stage 1 of 3) throughout.

Keep the stage 1 and 2 results visible as the user advances — do not replace, append below.

### API calls
Use the Anthropic API (`/api/anthropic` or however it is currently wired in this project). Model: `claude-sonnet-4-20250514`. Max tokens: 2000 per stage.

Each stage is a separate API call. Pass the original draft in all three calls. Pass stage 1 output into stage 2's context. Pass stage 1 + 2 output into stage 3's context.

### System prompt (use for all 3 stages)
```
You are a senior DTC wine copywriter and creative director specializing in Wine Spies — a spy-themed daily deal wine retailer where customers are called "Operatives." 

Wine Spies voice:
- FK reading grade 5–7. Short sentences. No padding.
- Punchy, direct, wry. Never precious or sycophantic about wine.
- Spy/operative framing when it fits naturally — never forced.
- Scarcity is real, not manufactured. State it plainly.
- Price anchoring is central — the deal is always part of the story.
- Tasting notes use concrete, physical language. No abstract wine terms (no minerality, terroir, structure as standalone claims). Make people taste it.
- Scores are contextualized, not just stated. "94 points — and Pinot almost never scores like that at this price" beats "94-point Pinot."
- Every writeup ends with a scarcity signal.

Evaluation rubric (score each 1–5):
1. Price arrives within first 3 sentences
2. Flavor copy uses concrete/physical language only
3. Score is contextualized, not just stated
4. CTA contains a friction-minimizing element
5. Producer story contains one non-wine surprise or character detail
6. Subject line leads with score or price
7. Narrator voice appears at least once (personal, warm, direct)
8. Scarcity signal appears in body AND close

Always be specific. Quote the actual lines you are flagging. Do not give generic feedback.
```

### Stage-specific prompts

**Stage 1 prompt (append to system):**
```
The user will provide a wine product writeup. Return line-by-line redline annotations.

Format each annotation as:
LINE: [quote the specific phrase or sentence]
ISSUE: [what's wrong or weak]
FIX: [a concrete suggestion or rewrite of that line]

Cover every significant weakness. Do not annotate lines that are already working well — only flag what needs to change. Be direct and specific.
```

**Stage 2 prompt (append to system):**
```
You have already provided redline annotations on this draft (included below). Now:

1. Score the draft against the 8-element rubric. Format as a simple table: Element | Score (1–5) | One-line note.

2. Identify the TOP 3 highest-leverage fixes — the changes that would most improve this copy if made right now. Number them 1–3, ranked by impact. For each: name the issue, explain why it matters most, and give a specific rewrite suggestion.

Redline annotations from Stage 1:
[INJECT STAGE 1 OUTPUT HERE]
```

**Stage 3 prompt (append to system):**
```
You have annotated and scored this draft (see below). Now write a complete rewrite.

Rules:
- Preserve all factual wine details (producer, region, score, price, vintage, varietal)
- Apply every fix identified in the redlines and rubric
- Match Wine Spies voice: FK 5–7, punchy, wry, spy-coded when natural
- Structure: hook → producer/wine story → tasting note → price anchor → scarcity close
- The rewrite should feel like the same writer had a better day, not like a different writer

Redlines and rubric from earlier stages:
[INJECT STAGE 1 + STAGE 2 OUTPUT HERE]
```

### UI design notes
- Match the existing Rory app aesthetic — do not introduce a new design system
- The paste area should be a large textarea, clearly labeled "Paste your writeup"
- Each stage result should render in a clearly delineated card or panel
- Stage labels: "Stage 1: Redlines", "Stage 2: Rubric & Priorities", "Stage 3: Rewrite"
- Add a "Copy rewrite" button on stage 3 output
- Add a "Start over" button that clears all state

---

## FILE LOCATIONS SUMMARY

```
app/
  copywriting/
    drill/
      page.jsx          ← drop copy-drill.jsx here (provided)
    critique/
      page.jsx          ← build from this spec
data/
  copy-drills.js        ← optional: extract TECHNIQUES array here
knowledge/
  competitor-intel/
    last-bottle/
      swipe-file.md     ← provided separately, for context injection
```

---

## WHAT NOT TO DO

- Do not restyle the Copy Drill component. The dark editorial aesthetic is intentional.
- Do not combine the drill and critique into a single page. They serve different moments.
- Do not add loading spinners between drill steps — it is a local state machine, no async.
- Do not stream the API responses for the critique tool — wait for each stage to complete before displaying. Streaming partial redlines is confusing.
- Do not add user accounts, history, or save functionality in this pass. Out of scope.
