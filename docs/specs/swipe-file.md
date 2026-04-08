# Swipe File — Feature Spec

## What Exists Today

### Pages
- `/swipes` — Unified swipe hub showing swipes from three sources: library items, extracted Last Bottle swipes, and drill exercises

### Components
- **SwipeGrid** — Grid/list layout for browsing swipes
- **SwipeFilters** — Filter by source, starred status, category, tags, search
- **SwipeModal** — Detail view with tabs: Content, Analysis, Drills
- **SwipeCard** — Individual swipe preview
- **AddSwipePanel** — Manually add new swipes
- **ExtractSwipesPanel** — Import swipes from external sources

### User Flow
1. Browse swipe collection with filters (source, starred, category, tags, search)
2. Click a swipe to see detail modal with three tabs:
   - **Content** — Full swipe text, "why it works" explanation, remix prompt
   - **Analysis** — Technical breakdown of structure and techniques
   - **Drills** — Related copywriting exercises
3. Star/unstar swipes for quick reference
4. Manually add new swipes or extract from Last Bottle markdown file

### Data Sources
- `/api/swipe-analysis/swipes` — Parses `docs/last-bottle-swipe-file.md` via regex
- Foreplay API integration for external ad swipes
- Manual entry via AddSwipePanel

### Known Issues / Limitations
- Single hardcoded file source — extraction parser reads from `docs/last-bottle-swipe-file.md`; adding new sources requires code changes
- Brittle markdown parsing — regex-based extraction breaks if formatting changes
- Categories inferred from `## TECHNIQUE` headers — fragile
- No sorting options (only filtering)
- No way to organize swipes into collections or folders
- Drill integration is display-only — no way to manage drills from here

---

## What I Want

<!--
Write your vision here. Some questions to consider:
- What should the ideal swipe browsing experience look like?
- How should swipes be organized? (tags, folders, collections, etc.)
- What sources should feed into the swipe file? (competitors, Foreplay, manual, URLs, screenshots)
- How should swipes connect to other features? (ad builder, copy editor, briefs)
- What's the ideal import/capture flow?
- Should there be AI analysis of swipes? What kind?
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
