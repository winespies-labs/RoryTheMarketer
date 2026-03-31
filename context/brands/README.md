# Per-brand context

Each brand has its own folder under `context/brands/{brandId}/` for:

- **personas.md** — Target personas (e.g. Value Analyst, Insider Hunter) with what they need in copy and lines that land
- **voice-guidelines.md** — Tone, vocabulary, word counts, scarcity language
- **usps.md** — USPs, pain points, competitive framing

The default brand (`winespies`) can still use the legacy `context/` folder at the project root if `context/brands/winespies/` is missing.

When you add a new brand in `src/lib/brands.ts`, create a folder here with the same `id` and add the markdown files above.
