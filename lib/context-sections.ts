export type SectionType = "markdown" | "meta-comments" | "brand-assets";

export interface SectionDef {
  id: string;
  label: string;
  type: SectionType;
  /** Filename relative to brand context dir (markdown sections only) */
  file?: string;
}

export interface CategoryDef {
  id: string;
  number: number;
  title: string;
  subtitle: string;
  sections: SectionDef[];
}

export const CATEGORIES: CategoryDef[] = [
  {
    id: "brand-dna",
    number: 1,
    title: "Brand DNA",
    subtitle: "Identity & Core Values",
    sections: [
      { id: "voice-guidelines", label: "Brand Voice & Guidelines", type: "markdown", file: "voice-guidelines.md" },
      { id: "usps", label: "Products & USPs", type: "markdown", file: "usps.md" },
      { id: "personas", label: "Customer Personas", type: "markdown", file: "personas.md" },
      { id: "wine-copy-guidance", label: "Wine Copy Guidance", type: "markdown", file: "wine-copy-guidance.md" },
    ],
  },
  {
    id: "strategy",
    number: 2,
    title: "Strategy",
    subtitle: "Market Position & Testing",
    sections: [
      { id: "ab-test-learnings", label: "A/B Test Learnings", type: "markdown", file: "ab-test-learnings.md" },
      { id: "video-creative", label: "Video Creative Guidelines", type: "markdown", file: "video-creative.md" },
      { id: "video-brief", label: "Video Brief Template", type: "markdown", file: "video_brief.md" },
      { id: "founder-brief", label: "Founder Brief", type: "markdown", file: "founder-brief.md" },
    ],
  },
  {
    id: "creative-ops",
    number: 3,
    title: "Creative Ops",
    subtitle: "Execution & Resources",
    sections: [
      { id: "brand-assets", label: "Brand Assets", type: "brand-assets" },
      { id: "meta-comments", label: "Meta Ad Comments", type: "meta-comments" },
    ],
  },
];

export const ALL_SECTIONS: SectionDef[] = CATEGORIES.flatMap((c) => c.sections);

export function getSectionDef(sectionId: string): SectionDef | undefined {
  return ALL_SECTIONS.find((s) => s.id === sectionId);
}

/** Only the markdown sections (ones with a file) */
export const MARKDOWN_SECTIONS = ALL_SECTIONS.filter(
  (s): s is SectionDef & { file: string } => s.type === "markdown" && !!s.file
);
