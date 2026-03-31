# Directive: Video Brief

## Purpose
Generate a complete video creative brief for a Wine Spies paid social or organic video ad.

## Required Inputs
- [ ] Wine name / campaign
- [ ] Video length (15s / 30s / 60s)
- [ ] Platform (Facebook, Instagram Reels, TikTok, YouTube pre-roll)
- [ ] Primary goal (conversions, awareness, retargeting)
- [ ] Target persona (see `knowledge/personas.md`)
- [ ] Hook angle or campaign theme (if known)
- [ ] Budget tier (UGC-style self-shoot / produced / animation)

## Knowledge Files to Load
- `knowledge/voice-guidelines.md`
- `knowledge/video-creative.md`  ← primary reference for hooks, frameworks, scripts
- `knowledge/personas.md`
- `knowledge/ab-test-learnings.md`

## Process

### Step 1: Choose a Hook Framework
Reference `knowledge/video-creative.md` for the full list. Choose the framework that best fits the campaign angle:

| Framework | Best For |
|-----------|----------|
| The Contrarian | Challenging grocery store / overpaying narrative |
| The Teacher | Varietal-specific audiences ("If you love Pinot...") |
| The Investigator | Exposing a deal, revealing value most people miss |
| The Magician | Visual-first — collection reveal, bottle reveal, price reveal |
| The Experimenter | Personal story / before & after |
| The Fortune Teller | Bold promise up front |

Then select or adapt a specific hook line from the approved hook library in `knowledge/video-creative.md`.

### Step 2: Structure the Story Arc
Map the beats for the full video length:

**15-second format:**
- 0–3s: Hook
- 3–10s: Proof (score, pedigree, deal)
- 10–15s: CTA + offer

**30-second format:**
- 0–3s: Hook
- 3–10s: Problem/desire (set up the want)
- 10–20s: Solution (this wine, this price)
- 20–27s: Proof (score, winemaker, value comparison)
- 27–30s: CTA + urgency

**60-second format:**
- 0–3s: Hook
- 3–15s: Story/context (the wine's angle — pedigree, steal, etc.)
- 15–35s: Product deep dive (what it is, what it tastes like — keep it real)
- 35–50s: Proof + deal reveal
- 50–60s: CTA + scarcity close

### Step 3: Write Scene-by-Scene
For each beat, specify:
- **Visual:** What's on screen
- **VO/Text:** What's being said or shown as text
- **Tone:** Energy level of this moment

### Step 4: Write the VO Script (if applicable)
Full verbatim script. FK target: 5–7. Conversational. Written to be SPOKEN, not read.

Reference the 4 approved script templates in `knowledge/video-creative.md` — adapt rather than start from scratch:
- **Option 1 (The Secret):** ~30s, cold audience, personal discovery angle
- **Option 2 (The Insider):** ~45s, full value prop including Locker
- **Option 3 (The Collector):** ~30–45s, visual-heavy, collection reveal
- **Option 4 (The Locker Explainer):** ~30–45s, mid-funnel, removes shipping objection

### Step 5: Write the End Card
- Offer/deal summary
- Wine Spies logo placement
- CTA (Shop Now / Get Yours / Today Only)

## Output Format

Save to: `outputs/video-briefs/YYYY-MM-DD_[campaign-slug].md`

```markdown
---
campaign: [Campaign Name]
wine: [Wine Name]
length: [15s / 30s / 60s]
platform: [Platform]
goal: [Conversions / Awareness / Retargeting]
persona: [Target Persona]
production: [UGC / Produced / Animation]
date: YYYY-MM-DD
---

# Video Brief: [Campaign Name]

## Campaign Summary
[2–3 sentences: what this video is, why now, what we want it to do]

## Hook (0–3s)
**Visual:** [What's on screen]  
**Text/VO:** [Exact words or text overlay]  
**Goal:** Stop the scroll

## Scene Breakdown

| Time | Visual | VO / Text Overlay | Tone |
|------|--------|-------------------|------|
| 0–3s | | | |
| 3–Xs | | | |
| Xs–Ys | | | |
| Ys–end | | | |

## Full VO Script
[Verbatim script if voiceover driven]

## End Card
[Deal summary + CTA + logo notes]

## Music Direction
[Vibe, energy, tempo — reference a song or genre]

## Talent / On-Camera Direction
[If applicable — who, what vibe, wardrobe notes]

## References / Inspiration
[Link or describe any reference videos or styles]

---
## Notes for Production
[Any technical flags, aspect ratio needs, or iteration notes]
```

## Quality Checklist
- [ ] Hook is ownable and scroll-stopping in first 3 seconds
- [ ] Deal/price is clearly communicated before the end
- [ ] CTA is specific and urgent
- [ ] VO script (if present) reads naturally when spoken aloud
- [ ] Scarcity or urgency appears somewhere in the video
- [ ] Length matches stated platform best practices
