import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { getBrandDataDir, ensureBrandDataDir } from "@/lib/brands";
import {
  type AdStyle,
  type AdStylesData,
  type GeneratedAd,
  type GenerationsData,
  AD_BUILDER_DIR,
  STYLES_FILENAME,
  GENERATIONS_FILENAME,
  STYLES_SUBDIR,
  GENERATED_SUBDIR,
} from "@/lib/ad-builder";

// --- Paths ---

export function getAdBuilderDir(brandId: string): string {
  return path.join(getBrandDataDir(brandId), AD_BUILDER_DIR);
}

export function ensureSubdir(brandId: string, subdir: string): string {
  const dir = path.join(getAdBuilderDir(brandId), subdir);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

function stylesPath(brandId: string): string {
  return path.join(getAdBuilderDir(brandId), STYLES_FILENAME);
}

function generationsPath(brandId: string): string {
  return path.join(getAdBuilderDir(brandId), GENERATIONS_FILENAME);
}

// --- Styles ---

function defaultStyles(): AdStylesData {
  return { updatedAt: new Date().toISOString(), styles: [] };
}

export function readStyles(brandId: string): AdStylesData {
  const fp = stylesPath(brandId);
  if (!fs.existsSync(fp)) return defaultStyles();
  try {
    const data = JSON.parse(fs.readFileSync(fp, "utf-8")) as AdStylesData;
    if (!Array.isArray(data?.styles)) return defaultStyles();
    return { updatedAt: data.updatedAt ?? "", styles: data.styles };
  } catch {
    return defaultStyles();
  }
}

function writeStyles(brandId: string, data: AdStylesData): void {
  ensureBrandDataDir(brandId);
  ensureSubdir(brandId, "");
  fs.writeFileSync(
    stylesPath(brandId),
    JSON.stringify({ ...data, updatedAt: new Date().toISOString() }, null, 2),
    "utf-8"
  );
}

export function addStyle(
  brandId: string,
  name: string,
  filename: string
): AdStyle {
  const data = readStyles(brandId);
  const style: AdStyle = {
    id: nanoid(),
    name,
    filename,
    addedAt: new Date().toISOString(),
  };
  data.styles.push(style);
  writeStyles(brandId, data);
  return style;
}

export function deleteStyle(brandId: string, id: string): boolean {
  const data = readStyles(brandId);
  const style = data.styles.find((s) => s.id === id);
  if (!style) return false;
  // Delete image file
  const imgPath = path.join(
    getAdBuilderDir(brandId),
    STYLES_SUBDIR,
    style.filename
  );
  if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  data.styles = data.styles.filter((s) => s.id !== id);
  writeStyles(brandId, data);
  return true;
}

// --- Generations ---

function defaultGenerations(): GenerationsData {
  return { updatedAt: new Date().toISOString(), generations: [] };
}

export function readGenerations(brandId: string): GenerationsData {
  const fp = generationsPath(brandId);
  if (!fs.existsSync(fp)) return defaultGenerations();
  try {
    const data = JSON.parse(
      fs.readFileSync(fp, "utf-8")
    ) as GenerationsData;
    if (!Array.isArray(data?.generations)) return defaultGenerations();
    return {
      updatedAt: data.updatedAt ?? "",
      generations: data.generations,
    };
  } catch {
    return defaultGenerations();
  }
}

function writeGenerations(brandId: string, data: GenerationsData): void {
  ensureBrandDataDir(brandId);
  ensureSubdir(brandId, "");
  fs.writeFileSync(
    generationsPath(brandId),
    JSON.stringify(
      { ...data, updatedAt: new Date().toISOString() },
      null,
      2
    ),
    "utf-8"
  );
}

export function addGeneration(
  brandId: string,
  gen: GeneratedAd
): GeneratedAd {
  const data = readGenerations(brandId);
  data.generations.push(gen);
  writeGenerations(brandId, data);
  return gen;
}

export function deleteGeneration(brandId: string, id: string): boolean {
  const data = readGenerations(brandId);
  const gen = data.generations.find((g) => g.id === id);
  if (!gen) return false;
  // Delete image file
  const imgPath = path.join(
    getAdBuilderDir(brandId),
    GENERATED_SUBDIR,
    gen.filename
  );
  if (fs.existsSync(imgPath)) fs.unlinkSync(imgPath);
  data.generations = data.generations.filter((g) => g.id !== id);
  writeGenerations(brandId, data);
  return true;
}

// --- File uploads ---

export function saveUploadedFile(
  brandId: string,
  subdir: string,
  buffer: Buffer,
  originalName: string
): string {
  const dir = ensureSubdir(brandId, subdir);
  const ext = path.extname(originalName) || ".png";
  const filename = `${nanoid()}${ext}`;
  fs.writeFileSync(path.join(dir, filename), buffer);
  return filename;
}
