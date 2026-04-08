import fs from "fs";
import path from "path";
import matter from "gray-matter";
import { nanoid } from "nanoid";

import type { AdType, AspectRatio } from "@/lib/ad-builder";

export type ReferenceAdFrontmatter = {
  id: string;
  label: string;
  brand: string;
  platform: string;
  format: string;
  objective?: string;
  angle?: string;
  nanoBanana?: string;
  imageFile?: string;
  promptTemplateId: string;
  promptOverrides?: Record<string, unknown>;
  notes?: string;
  type?: AdType;
  aspectRatio?: AspectRatio;
};

export type ReferenceAd = {
  meta: ReferenceAdFrontmatter;
  primaryText: string;
  headline: string;
  description: string;
  visualNotes: string;
  adDescription: string;
  /** Full Nano Banana generation prompt with {{token}} placeholders, if present. */
  generationPrompt: string;
  rawMarkdown: string;
};

function getStaticAdsDir(): string {
  // Example ads live under context/Examples/Ads/Static (per project notes)
  return path.join(process.cwd(), "context", "Examples", "Ads", "Static");
}

function extractSection(markdown: string, heading: string): string {
  const pattern = new RegExp(
    `^### ${heading}\\s*\\n([\\s\\S]*?)(?=^### |^## |\\Z)`,
    "m",
  );
  const match = markdown.match(pattern);
  return match ? match[1].trim() : "";
}

function extractAdCreativeDetails(markdown: string): string {
  const pattern = new RegExp(
    `^## Ad Creative Details\\s*\\n([\\s\\S]*?)(?=^## |\\Z)`,
    "m",
  );
  const match = markdown.match(pattern);
  return match ? match[1].trim() : "";
}

function extractAdDescription(markdown: string): string {
  const pattern = /^## Ad Description\s*\n([\s\S]*?)(?=^## |\Z)/m;
  const match = markdown.match(pattern);
  return match ? match[1].trim() : "";
}

function extractGenerationPrompt(markdown: string): string {
  const pattern = /^## Generation Prompt\s*\n([\s\S]*?)(?=^## |\Z)/m;
  const match = markdown.match(pattern);
  return match ? match[1].trim() : "";
}

export function listReferenceAds(): ReferenceAdFrontmatter[] {
  const dir = getStaticAdsDir();
  if (!fs.existsSync(dir)) return [];

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".md") || f.toLowerCase().endsWith(".markdown"));

  const results: ReferenceAdFrontmatter[] = [];

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const raw = fs.readFileSync(fullPath, "utf8");
    const parsed = matter(raw);
    const fm = parsed.data as Partial<ReferenceAdFrontmatter>;
    if (!fm.id) continue;
    results.push({
      id: fm.id,
      label: fm.label ?? fm.id,
      brand: fm.brand ?? "",
      platform: fm.platform ?? "",
      format: fm.format ?? "",
      objective: fm.objective,
      angle: fm.angle,
      nanoBanana: fm.nanoBanana,
      imageFile: fm.imageFile,
      promptTemplateId: fm.promptTemplateId ?? "nano-banana-meta-static",
      promptOverrides: fm.promptOverrides ?? {},
      notes: fm.notes,
      type: (fm as Record<string, unknown>).type as AdType | undefined,
      aspectRatio: (fm as Record<string, unknown>).aspectRatio as AspectRatio | undefined,
    });
  }

  return results;
}

export function getReferenceAdById(id: string): ReferenceAd | null {
  const dir = getStaticAdsDir();
  if (!fs.existsSync(dir)) return null;

  const files = fs
    .readdirSync(dir)
    .filter((f) => f.toLowerCase().endsWith(".md") || f.toLowerCase().endsWith(".markdown"));

  for (const file of files) {
    const fullPath = path.join(dir, file);
    const raw = fs.readFileSync(fullPath, "utf8");
    const parsed = matter(raw);
    const fm = parsed.data as Partial<ReferenceAdFrontmatter>;

    if (!fm.id || fm.id !== id) continue;

    const meta: ReferenceAdFrontmatter = {
      id: fm.id,
      label: fm.label ?? id,
      brand: fm.brand ?? "",
      platform: fm.platform ?? "",
      format: fm.format ?? "",
      objective: fm.objective,
      angle: fm.angle,
      nanoBanana: fm.nanoBanana,
      imageFile: fm.imageFile,
      promptTemplateId: fm.promptTemplateId ?? "nano-banana-meta-static",
      promptOverrides: fm.promptOverrides ?? {},
      notes: fm.notes,
      type: (fm as Record<string, unknown>).type as AdType | undefined,
      aspectRatio: (fm as Record<string, unknown>).aspectRatio as AspectRatio | undefined,
    };

    const content = parsed.content ?? "";
    const primaryText = extractSection(content, "PRIMARY TEXT");
    const headline = extractSection(content, "HEADLINE");
    const description = extractSection(content, "DESCRIPTION");
    const visualNotes = extractAdCreativeDetails(content);

    // New format: single Ad Description section
    let adDescription = extractAdDescription(content);
    // Backward compat: if no Ad Description section, concatenate structured sections
    if (!adDescription) {
      const parts: string[] = [];
      if (visualNotes) parts.push(`Visual Layout:\n${visualNotes}`);
      if (primaryText) parts.push(`Primary Text:\n${primaryText}`);
      if (headline) parts.push(`Headline:\n${headline}`);
      if (description) parts.push(`Description:\n${description}`);
      const promptGuidance = extractPromptGuidance(raw);
      if (promptGuidance) parts.push(`Prompt Guidance:\n${promptGuidance}`);
      adDescription = parts.join("\n\n");
    }

    return {
      meta,
      primaryText,
      headline,
      description,
      visualNotes,
      adDescription,
      generationPrompt: extractGenerationPrompt(raw),
      rawMarkdown: raw,
    };
  }

  return null;
}

/** Path to the reference ad's style image (e.g. PDP_CULT_1.png), or null if none. */
export function getReferenceAdStyleImagePath(referenceId: string): string | null {
  const ad = getReferenceAdById(referenceId);
  if (!ad?.meta.imageFile) return null;
  const dir = getStaticAdsDir();
  const imagePath = path.join(dir, ad.meta.imageFile);
  return fs.existsSync(imagePath) ? imagePath : null;
}

// --- CRUD Types ---

export type ReferenceAdCreateInput = {
  label: string;
  brand: string;
  platform?: string;
  format?: string;
  type?: AdType;
  aspectRatio?: AspectRatio;
  objective?: string;
  angle?: string;
  nanoBanana?: string;
  notes?: string;
  promptOverrides?: Record<string, unknown>;
  primaryText?: string;
  headline?: string;
  description?: string;
  visualNotes?: string;
  promptGuidance?: string;
  adDescription?: string;
};

export type ReferenceAdUpdateInput = Partial<ReferenceAdCreateInput> & {
  id: string;
};

export type ReferenceAdSections = {
  primaryText?: string;
  headline?: string;
  description?: string;
  visualNotes?: string;
  promptGuidance?: string;
};

// --- CRUD Functions ---

function sanitizeFilename(name: string): string {
  return name
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_|_$/g, "")
    .slice(0, 50);
}

export function buildMarkdownFromDescription(
  frontmatter: Record<string, unknown>,
  adDescription: string,
): string {
  const fm = matter.stringify("", frontmatter).trim();
  const parts: string[] = [fm, ""];
  if (adDescription) {
    parts.push("## Ad Description", "", adDescription, "");
  }
  return parts.join("\n");
}

export function buildMarkdownFromSections(
  frontmatter: Record<string, unknown>,
  sections: ReferenceAdSections,
): string {
  const fm = matter.stringify("", frontmatter).trim();

  const parts: string[] = [fm, ""];

  if (sections.visualNotes) {
    parts.push("## Ad Creative Details", "", "### Visual Layout");
    parts.push(sections.visualNotes, "", "---", "");
  }

  if (sections.primaryText) {
    parts.push("### PRIMARY TEXT", "", sections.primaryText, "", "---", "");
  }

  if (sections.headline) {
    parts.push("### HEADLINE", "", sections.headline, "", "---", "");
  }

  if (sections.description) {
    parts.push("### DESCRIPTION", "", sections.description, "", "---", "");
  }

  if (sections.promptGuidance) {
    parts.push(
      "## Prompt Guidance for Variations",
      "",
      sections.promptGuidance,
      "",
    );
  }

  return parts.join("\n");
}

export function createReferenceAd(
  input: ReferenceAdCreateInput,
  imageBuffer: Buffer,
  imageExt: string,
): ReferenceAdFrontmatter {
  const dir = getStaticAdsDir();
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  const id = `ref_${nanoid(8)}`;
  const sanitized = sanitizeFilename(input.label);
  const ext = imageExt.startsWith(".") ? imageExt : `.${imageExt}`;
  const imageFilename = `${id}_${sanitized}${ext}`;

  // Write image
  fs.writeFileSync(path.join(dir, imageFilename), imageBuffer);

  // Build frontmatter
  const fmData: Record<string, unknown> = {
    id,
    label: input.label,
    brand: input.brand,
    platform: input.platform || "meta",
    format: input.format || "static_image",
    type: input.type,
    aspectRatio: input.aspectRatio,
    objective: input.objective,
    angle: input.angle,
    nanoBanana: input.nanoBanana,
    imageFile: imageFilename,
    promptTemplateId: "nano-banana-meta-static",
    promptOverrides: input.promptOverrides || {},
    notes: input.notes,
  };

  // Remove undefined values
  for (const key of Object.keys(fmData)) {
    if (fmData[key] === undefined) delete fmData[key];
  }

  const markdown = input.adDescription
    ? buildMarkdownFromDescription(fmData, input.adDescription)
    : buildMarkdownFromSections(fmData, {
        primaryText: input.primaryText,
        headline: input.headline,
        description: input.description,
        visualNotes: input.visualNotes,
        promptGuidance: input.promptGuidance,
      });

  // Write markdown
  fs.writeFileSync(path.join(dir, `${id}.md`), markdown, "utf8");

  return {
    id,
    label: input.label,
    brand: input.brand,
    platform: fmData.platform as string,
    format: fmData.format as string,
    objective: input.objective,
    angle: input.angle,
    nanoBanana: input.nanoBanana,
    imageFile: imageFilename,
    promptTemplateId: "nano-banana-meta-static",
    promptOverrides: input.promptOverrides || {},
    notes: input.notes,
    type: input.type,
    aspectRatio: input.aspectRatio,
  };
}

export function updateReferenceAd(
  input: ReferenceAdUpdateInput,
  imageBuffer?: Buffer,
  imageExt?: string,
): ReferenceAdFrontmatter | null {
  const existing = getReferenceAdById(input.id);
  if (!existing) return null;

  const dir = getStaticAdsDir();

  // Find the existing markdown file
  const mdFile = fs
    .readdirSync(dir)
    .find((f) => {
      if (!f.endsWith(".md") && !f.endsWith(".markdown")) return false;
      const raw = fs.readFileSync(path.join(dir, f), "utf8");
      const parsed = matter(raw);
      return parsed.data.id === input.id;
    });

  if (!mdFile) return null;
  const mdPath = path.join(dir, mdFile);

  // Handle new image
  let imageFilename = existing.meta.imageFile;
  if (imageBuffer && imageExt) {
    // Delete old image
    if (existing.meta.imageFile) {
      const oldImagePath = path.join(dir, existing.meta.imageFile);
      if (fs.existsSync(oldImagePath)) fs.unlinkSync(oldImagePath);
    }
    const sanitized = sanitizeFilename(input.label || existing.meta.label);
    const ext = imageExt.startsWith(".") ? imageExt : `.${imageExt}`;
    imageFilename = `${input.id}_${sanitized}${ext}`;
    fs.writeFileSync(path.join(dir, imageFilename), imageBuffer);
  }

  // Merge frontmatter
  const fmData: Record<string, unknown> = {
    id: input.id,
    label: input.label ?? existing.meta.label,
    brand: input.brand ?? existing.meta.brand,
    platform: input.platform ?? existing.meta.platform,
    format: input.format ?? existing.meta.format,
    type: input.type !== undefined ? input.type : existing.meta.type,
    aspectRatio:
      input.aspectRatio !== undefined
        ? input.aspectRatio
        : existing.meta.aspectRatio,
    objective: input.objective ?? existing.meta.objective,
    angle: input.angle ?? existing.meta.angle,
    nanoBanana: input.nanoBanana ?? existing.meta.nanoBanana,
    imageFile: imageFilename,
    promptTemplateId: existing.meta.promptTemplateId,
    promptOverrides: input.promptOverrides ?? existing.meta.promptOverrides,
    notes: input.notes ?? existing.meta.notes,
  };

  // Remove undefined values
  for (const key of Object.keys(fmData)) {
    if (fmData[key] === undefined) delete fmData[key];
  }

  // Use adDescription format if provided, otherwise fall back to structured sections
  const adDesc = input.adDescription !== undefined ? input.adDescription : null;

  let markdown: string;
  if (adDesc !== null) {
    markdown = buildMarkdownFromDescription(fmData, adDesc);
  } else {
    const sections: ReferenceAdSections = {
      primaryText:
        input.primaryText !== undefined
          ? input.primaryText
          : existing.primaryText,
      headline:
        input.headline !== undefined ? input.headline : existing.headline,
      description:
        input.description !== undefined
          ? input.description
          : existing.description,
      visualNotes:
        input.visualNotes !== undefined
          ? input.visualNotes
          : existing.visualNotes,
      promptGuidance:
        input.promptGuidance !== undefined
          ? input.promptGuidance
          : (extractPromptGuidance(existing.rawMarkdown) || undefined),
    };
    markdown = buildMarkdownFromSections(fmData, sections);
  }

  fs.writeFileSync(mdPath, markdown, "utf8");

  return {
    id: input.id,
    label: fmData.label as string,
    brand: fmData.brand as string,
    platform: fmData.platform as string,
    format: fmData.format as string,
    objective: fmData.objective as string | undefined,
    angle: fmData.angle as string | undefined,
    nanoBanana: fmData.nanoBanana as string | undefined,
    imageFile: imageFilename,
    promptTemplateId: fmData.promptTemplateId as string,
    promptOverrides: (fmData.promptOverrides as Record<string, unknown>) || {},
    notes: fmData.notes as string | undefined,
    type: fmData.type as AdType | undefined,
    aspectRatio: fmData.aspectRatio as AspectRatio | undefined,
  };
}

export function deleteReferenceAd(id: string): boolean {
  const ad = getReferenceAdById(id);
  if (!ad) return false;

  const dir = getStaticAdsDir();

  // Find and delete markdown file
  const mdFile = fs
    .readdirSync(dir)
    .find((f) => {
      if (!f.endsWith(".md") && !f.endsWith(".markdown")) return false;
      const raw = fs.readFileSync(path.join(dir, f), "utf8");
      const parsed = matter(raw);
      return parsed.data.id === id;
    });

  if (mdFile) {
    fs.unlinkSync(path.join(dir, mdFile));
  }

  // Delete image
  if (ad.meta.imageFile) {
    const imagePath = path.join(dir, ad.meta.imageFile);
    if (fs.existsSync(imagePath)) fs.unlinkSync(imagePath);
  }

  return true;
}

function extractPromptGuidance(markdown: string): string {
  const pattern = /^## Prompt Guidance for Variations\s*\n([\s\S]*?)(?=^## |\Z)/m;
  const match = markdown.match(pattern);
  return match ? match[1].trim() : "";
}
