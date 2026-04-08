---
id: winespies_pdp_cult_1
label: Wine Spies – PDP Cult 1
brand: winespies
platform: meta
format: static_image
type: pdp
aspectRatio: "1:1"
objective: conversions
angle: cult_cabernet_deal
nanoBanana: "98-point Napa Cab from Julian Fayard — $125 elsewhere, $25 today. Take another $50 off with FIRST50."
imageFile: PDP_CULT_1.png
promptTemplateId: nano-banana-meta-static
promptOverrides:
  numberOfVariations: 3
  emphasizeScarcity: true
  includeReviewThemes: true
  pricingDisplay: strikethrough_with_deal_price
  ctaStyle: direct_action
notes: >
  Cold traffic conversion ad built around a dramatic price anchor ($125 → $25) plus a stacked
  new-member promo (FIRST50 = $50 off). Wine is the Cult "Beau Gore Collection" 15th Anniversary
  2023 Napa Valley Cabernet Sauvignon, 98 pts, described as a "milestone bottling" by winemaker
  Julian Fayard. Key trust signals: Trustpilot badge (Excellent, 1300+ reviews) and the score
  credibility framing ("all the hallmarks of a $100+ Napa Cab for a lot less"). Evergreen-suitable
  but scarcity language ("limited time") should be preserved in all variations.
---

## Ad Creative Details

### Visual Layout
- **Background:** Dark/black with dramatic deep-red atmospheric smoke around the bottle
- **Bottle position:** Right-center, full bleed, slightly angled — dominant visual anchor
- **Logo placement:** Top-left, white Wine Spies wordmark
- **Trust badge:** Beneath logo — "Excellent ★★★★★ 1300+ reviews on Trustpilot"
- **Score treatment:** Oversized bold white "98 points" — largest text element on the page
- **Price block:** Two-cell row — left cell white bg ("elsewhere / $125"), right cell red bg ("limited time / $25")
- **CTA button:** Full-width white button with bold dark text "GET THIS DEAL"
- **Promo line:** Small white text below CTA — "Take $50 off with FIRST50"

---

### PRIMARY TEXT

98-point Napa Cabernet. $125 everywhere else. $25 today.

Julian Fayard called it a "milestone bottling" — and this 15th Anniversary Cult Cab from the Beau Gore Collection drinks like it. All the hallmarks of a serious $100+ Napa Cab, without the $100+ price tag.

New member? Stack FIRST50 at checkout for an extra $50 off your first order.

This one won't last. → WineSpies.com

---

### HEADLINE

98-Point Napa Cab — $125 Retail for $25

---

### DESCRIPTION

Julian Fayard's "milestone bottling." Deep discount, serious wine. New members save even more with FIRST50.

---

## Prompt Guidance for Variations

When generating variations from this reference ad, maintain:
1. **The score** (98 points) as the primary hook — it's the credibility engine
2. **The price anchor** ($125 → $25) as the value proof — lead with the gap, not just the final price
3. **FIRST50** callout — new member incentive is a key conversion lever for cold traffic
4. **Julian Fayard / "milestone bottling"** quote — adds critic/winemaker credibility without being stuffy
5. **Scarcity signal** — "limited time" or equivalent; do not remove

Angle variants to explore:
- **Score-first:** Open with "98 points" as the lede, build to price
- **Price-first:** Open with the $125 → $25 gap, validate with the score
- **Winemaker authority:** Lead with Julian Fayard / milestone bottling framing, land on deal

---

## Generation Prompt

Use the attached images as brand reference. Create a 1:1 (1080×1080px) square wine offer advertisement for Wine Spies.

BACKGROUND: Near-black (#0A0A0A) with dramatic deep crimson-red atmospheric smoke/haze radiating outward from behind the bottle. Moody, premium, dramatic feel — not flat or clean.

BOTTLE: The provided bottle image is the hero. Place it right-center, full bleed, slightly angled — the single dominant visual element. Render the label faithfully — do not alter its text, colors, or shape. Let the smoke atmosphere frame the bottle.

TOP-LEFT CORNER:
- White "wine spies" wordmark in clean sans-serif (two lines stacked: "wine" / "spies"), ~18px
- Directly beneath: "Excellent ★★★★★ 1300+ reviews on Trustpilot" in white, ~10px

LEFT-SIDE TEXT BLOCK (vertically stacked, left-aligned, occupying left ~55% of canvas):
1. SCORE: "{{score}}" — oversized, heavy-weight white sans-serif, ~60px. This is the largest text on the ad. If score is blank, omit this element entirely.
2. WINE NAME: "{{wineName}}" — white serif or semi-serif, ~20px, 2 lines max, below score with ~10px gap
3. BODY COPY: "{{pullQuote}}" — small white text, ~13px, 3 lines max, below wine name with ~12px gap

PRICE BLOCK (below body copy, ~20px gap):
Two pills displayed side by side. CRITICAL — both pills must be EXACTLY identical in dimensions: 90px wide × 34px tall, 17px border-radius (fully pill-shaped, not square-cornered).
- LEFT PILL: white background #FFFFFF, black text #000000, 14px bold: "{{retailPrice}}"
- RIGHT PILL: #C41E3A crimson-red background, white text #FFFFFF, 14px bold: "{{salePrice}}"
Both pills: same font size, same font weight, same height, same width, same 17px border-radius. No exceptions. The pills sit on the same horizontal baseline.

CTA BUTTON (below price pills, ~14px gap):
Rounded rectangle, white fill #FFFFFF, exactly 6px border-radius (NOT pill-shaped — 6px only, square-ish corners). Bold dark text #1A1A1A, 14px: "{{ctaText}}"
Button width matches the combined width of both price pills plus the gap between them.

REQUIREMENTS:
- 1080×1080px output
- Render all text VERBATIM as provided — do not rephrase, shorten, or invent copy
- Include ONLY the text elements listed above — no extra copy, taglines, or invented phrases
- If any token (like {{score}}) resolves to blank, omit that element and close the gap
- Crisp, legible typography throughout — no blurry text
- Professional quality suitable for Meta social media advertising
