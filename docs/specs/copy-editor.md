# Copy Editor — Feature Spec

## What Exists Today

### Pages
- `/copywriting` — Hub page linking to Editor, Library, Swipes, and Drills
- `/copywriting/editor` — Main copywriting workspace (split-pane layout)
- `/copywriting/library` — Published writeups gallery with scores
- `/copywriter` — Redirects to `/copywriting/editor`
- `/copywriting/drill` — Redirects to `/swipes`
- `/copywriting/swipe-analyzer` — Swipe analysis tool

### Components
- **EditorPanel** — Main textarea with auto-save (30s debounce), word count, title
- **ResearchPanel** — Brand context, persona guidance, wine details
- **ReviewPanel** — AI critique results as redline cards (apply/dismiss/scroll-to-issue)
- **PublishPanel** — Score rings, publish/unpublish actions
- **DraftsDrawer** — Saved drafts list with load/delete
- **ScoreRing** — Visual donut chart (0-100 from 40-point rubric)
- **CritiqueCard** — Individual redline with issue, fix, severity

### User Flow
1. Open editor, create new or load a draft
2. **Write** — Type copy in textarea; auto-saves every 30s; real-time Flesch-Kincaid reading level
3. **Critique** — Click "Critique" to send to Claude; returns:
   - 8-element rubric (1-5 each): price arrival, concrete flavor language, score contextualization, CTA friction, producer story surprise, subject line lead, narrator voice, scarcity signals
   - 4-10 redline items with exact quote, issue, fix, severity
   - Flesch-Kincaid, word count, energy level, biggest weakness
4. **Refine** — Edit based on critique; can re-critique to verify improvements
5. **Publish** — Add title, publish; appears in library with score ring

### API Routes
- `/api/copywriter` — Claude-powered copy/writeup generation (supports copy type, persona, swipe context)
- `/api/critique` — AI critique engine; structured JSON rubric + redlines

### Known Issues / Limitations
- Critique is read-only — users must manually apply each fix; no "apply all" or auto-rewrite
- Legacy three-stage critique path exists in API but isn't exposed in UI
- Score mapping is opaque — users can't see which rubric elements drove the score
- No target reading level setting — calculates but doesn't adapt feedback to a goal
- Redline matching is fragile — exact text match breaks if copy changes between critique and edit
- Copy generation (`/api/copywriter`) and editor are separate — no unified generate-then-refine flow
- No version history — can't compare revisions or see how a piece evolved
- No performance tracking — scores are structural, not tied to real-world results
- Published writeups can't be versioned or scheduled

---

## What I Want

<!--
Write your vision here. Some questions to consider:
- What types of copy should this handle? (wine writeups, ad copy, emails, social?)
- What's the ideal write-critique-refine loop?
- How should AI generation fit in? (starting point? rewrite? section-by-section?)
- Should the critique rubric be customizable per copy type?
- How should drafts and versions work?
- How does this connect to the ad builder and briefs?
- What about templates or structured formats?
- Should there be a way to compare your copy against swipe file examples?
-->

---

## Changes to Make

<!--
List specific changes as you plan them. Example format:

### Phase 1: [name]
- Change X to Y
- Add Z

### Phase 2: [name]
- ...
-->
