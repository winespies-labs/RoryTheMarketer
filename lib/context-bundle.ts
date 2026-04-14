import fs from "fs";
import path from "path";
import { getBrandContextDir } from "./brands";
import { readReviewThemes } from "./review-themes-storage";
import { readMetaCommentThemes } from "./meta-comments-storage";
import { loadTopTestimonialsForContext } from "./reviews-storage";
import type { UspCategory } from "./reviews";

function readMarkdownFile(filePath: string): string {
  if (!fs.existsSync(filePath)) return "";
  return fs.readFileSync(filePath, "utf-8").trim();
}

export interface ContextBundle {
  brand: string;
  voice: string;
  personas: string;
  usps: string;
  wineCopyGuidance: string;
  abTestLearnings: string;
  videoBrief: string;
  videoCreative: string;
  imagePromptModifier: string;
  reviewThemes: string;
  metaCommentThemes: string;
  testimonials: string;
}

const USP_LABELS: Record<UspCategory, string> = {
  "best-price": "Best Price",
  "locker": "The Locker",
  "satisfaction-guaranteed": "Satisfaction Guaranteed",
};

export async function getContextBundle(brandId: string): Promise<ContextBundle> {
  const dir = getBrandContextDir(brandId);

  const reviewThemes = readReviewThemes(brandId);
  const commentThemes = readMetaCommentThemes(brandId);
  const topTestimonials = await loadTopTestimonialsForContext(brandId);

  // Format testimonials grouped by USP
  let testimonialsText = "";
  if (topTestimonials.length > 0) {
    const byUsp = new Map<UspCategory, typeof topTestimonials>();
    for (const t of topTestimonials) {
      if (!t.uspCategory) continue;
      const group = byUsp.get(t.uspCategory) ?? [];
      group.push(t);
      byUsp.set(t.uspCategory, group);
    }
    const sections: string[] = [];
    for (const [usp, reviews] of byUsp) {
      const label = USP_LABELS[usp];
      const quotes = reviews
        .filter((r) => r.extractedQuote)
        .map((r) => `  - "${r.extractedQuote}"${r.author ? ` — ${r.author}` : ""}`)
        .join("\n");
      if (quotes) sections.push(`### ${label}\n${quotes}`);
    }
    testimonialsText = sections.join("\n\n");
  }

  return {
    brand: brandId,
    voice: readMarkdownFile(path.join(dir, "voice-guidelines.md")),
    personas: readMarkdownFile(path.join(dir, "personas.md")),
    usps: readMarkdownFile(path.join(dir, "usps.md")),
    wineCopyGuidance: readMarkdownFile(path.join(dir, "wine-copy-guidance.md")),
    abTestLearnings: readMarkdownFile(path.join(dir, "ab-test-learnings.md")),
    videoBrief: readMarkdownFile(path.join(dir, "video_brief.md")),
    videoCreative: readMarkdownFile(path.join(dir, "video-creative.md")),
    imagePromptModifier: readMarkdownFile(path.join(dir, "image-prompt-modifier.md")),
    reviewThemes: reviewThemes?.summary ?? "",
    metaCommentThemes: commentThemes?.summary ?? "",
    testimonials: testimonialsText,
  };
}

export function formatContextForPrompt(bundle: ContextBundle): string {
  const sections: string[] = [];

  if (bundle.voice) {
    sections.push(`## Brand Voice\n\n${bundle.voice}`);
  }
  if (bundle.personas) {
    sections.push(`## Target Personas\n\n${bundle.personas}`);
  }
  if (bundle.usps) {
    sections.push(`## Unique Selling Propositions\n\n${bundle.usps}`);
  }
  if (bundle.wineCopyGuidance) {
    sections.push(`## Wine Copy Guidance\n\n${bundle.wineCopyGuidance}`);
  }
  if (bundle.abTestLearnings) {
    sections.push(`## A/B Test Learnings\n\n${bundle.abTestLearnings}`);
  }
  if (bundle.reviewThemes) {
    sections.push(`## Customer Review Themes\n\nThese are recurring themes from real customer reviews (Trustpilot and App Store). Use these insights for copy, positioning, and objection handling.\n\n${bundle.reviewThemes}`);
  }
  if (bundle.metaCommentThemes) {
    sections.push(`## Ad Comment Themes\n\nThese are recurring themes from comments on the brand's Meta ads. Use these to understand audience reactions and objections.\n\n${bundle.metaCommentThemes}`);
  }
  if (bundle.testimonials) {
    sections.push(`## Top Customer Testimonials\n\nHigh-scoring real customer quotes organized by USP. Use these verbatim or as inspiration for social proof in copy.\n\n${bundle.testimonials}`);
  }

  return sections.join("\n\n---\n\n");
}
