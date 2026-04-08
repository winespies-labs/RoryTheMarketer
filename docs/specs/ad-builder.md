# Ad Builder — Feature Spec

## What Exists Today

### Pages
- `/ad-builder` — Multi-step wizard (6 steps: Ad Type, Select Wines, Templates, Review Brief, Review & Edit, Publish)

### Components
- **BuilderStepIndicator** — Step progress bar
- **BriefReviewStep** — Side-by-side slot editors + live HTML preview (auto-refreshes on edit)
- **ReferenceAdEditor** — Create/edit reference ad templates (slide-over panel)

### Steps (PDP Mode)
1. **Ad Type** — Choose PDP (product display) or Other (testimonial, comparison, offer, UGC, lifestyle)
2. **Select Wines** — Pick wines from current inventory (search, filter by channel)
3. **Templates** — Choose Basic (bottle photo) or Templated (reference ads + AI image gen), or HTML templates
4. **Review Brief** — Edit slot values with live HTML preview (side-by-side layout)
5. **Review & Edit** — Generated ad results with editable copy fields, save/select ads, AI chat sidebar
6. **Publish** — Select ad set, choose status (Active/Paused), push to Meta

### Two Generation Paths
- **Basic/Templated** — Wine details + reference ad + Claude copy + Gemini/FAL image generation via `/api/wines/generate-single`
- **HTML Template** — Wine data resolved into template slots, Puppeteer screenshot via `/api/ad-builder/generate-html-ad`

### API Routes
- `/api/ad-builder/assemble-brief` — Resolves wine data into template schema slots
- `/api/ad-builder/preview-html` — Returns filled HTML for iframe preview
- `/api/ad-builder/generate-html-ad` — Puppeteer screenshot of filled HTML template
- `/api/ad-builder/saved-ads` — CRUD for saved ad drafts
- `/api/ad-builder/templates` — Lists available HTML templates
- `/api/ad-builder/copy` — Claude-powered copy generation
- `/api/wines/generate-single` — Full copy + image generation pipeline
- `/api/wines/publish-to-meta` — Push ads to Meta Ads account

### Template System
- Templates live in `templates/{id}/` with `schema.json` (slot definitions, max_chars) and `template.html` ({{token}} placeholders)
- Token resolution via `lib/prompt-variables.ts`
- Currently one active template: Cult Dark

### Known Issues / Limitations
- Reference ad editing doesn't persist across sessions
- No batch generation — each ad requires manual setup
- Image generation is slow (external API calls block the flow)
- Template schema is hardcoded — adding new templates requires file creation
- No A/B variant comparison or winner selection built in
- No way to regenerate just the image or just the copy independently
- Aspect ratio fixed per session — can't generate multiple sizes at once

---

## What I Want

<!--
Write your vision here. Some questions to consider:
- What's the ideal ad creation flow from start to finish?
- How should templates work? (more templates, easier to create, dynamic slots?)
- What role should AI play? (copy only? image direction? full creative?)
- How should the review/approval process work?
- What about versioning — iterating on an ad through multiple rounds?
- How should this connect to swipes and briefs?
- What's the ideal publish flow? (scheduling, A/B testing, bulk publish?)
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
