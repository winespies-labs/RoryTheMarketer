import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { getBrandDataDir, ensureBrandDataDir } from "@/lib/brands";
import {
  type BrandAssetsData,
  type BrandAsset,
  type AssetCategory,
  BRAND_ASSETS_FILENAME,
  BRAND_ASSETS_DIR,
} from "@/lib/brand-assets";

function getDataPath(brandId: string): string {
  return path.join(getBrandDataDir(brandId), BRAND_ASSETS_FILENAME);
}

export function getAssetsDir(brandId: string): string {
  return path.join(getBrandDataDir(brandId), BRAND_ASSETS_DIR);
}

function defaultData(): BrandAssetsData {
  return { updatedAt: new Date().toISOString(), assets: [] };
}

export function readBrandAssets(brandId: string): BrandAssetsData {
  const filePath = getDataPath(brandId);
  if (!fs.existsSync(filePath)) return defaultData();
  const raw = fs.readFileSync(filePath, "utf-8");
  try {
    const data = JSON.parse(raw) as BrandAssetsData;
    if (!Array.isArray(data?.assets)) return defaultData();
    return { updatedAt: data.updatedAt ?? "", assets: data.assets };
  } catch {
    return defaultData();
  }
}

function writeBrandAssets(brandId: string, data: BrandAssetsData): void {
  ensureBrandDataDir(brandId);
  const next: BrandAssetsData = {
    ...data,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(getDataPath(brandId), JSON.stringify(next, null, 2), "utf-8");
}

export function addBrandAsset(
  brandId: string,
  item: { label: string; category: AssetCategory; filename: string; originalName?: string }
): BrandAsset {
  const data = readBrandAssets(brandId);
  const newAsset: BrandAsset = {
    id: nanoid(),
    label: item.label,
    category: item.category,
    filename: item.filename,
    originalName: item.originalName,
    uploadedAt: new Date().toISOString(),
  };
  data.assets.push(newAsset);
  writeBrandAssets(brandId, data);
  return newAsset;
}

export function deleteBrandAsset(brandId: string, id: string): boolean {
  const data = readBrandAssets(brandId);
  const asset = data.assets.find((a) => a.id === id);
  if (!asset) return false;

  // Remove image file
  const imagePath = path.join(getAssetsDir(brandId), asset.filename);
  if (fs.existsSync(imagePath)) {
    try {
      fs.unlinkSync(imagePath);
    } catch {
      // ignore
    }
  }

  data.assets = data.assets.filter((a) => a.id !== id);
  writeBrandAssets(brandId, data);
  return true;
}

export function getBrandAssetById(brandId: string, id: string): BrandAsset | null {
  const data = readBrandAssets(brandId);
  return data.assets.find((a) => a.id === id) ?? null;
}

export function saveBrandAssetFile(
  brandId: string,
  buffer: Buffer,
  originalName: string
): string {
  ensureBrandDataDir(brandId);
  const assetsDir = getAssetsDir(brandId);
  if (!fs.existsSync(assetsDir)) {
    fs.mkdirSync(assetsDir, { recursive: true });
  }

  const ext = path.extname(originalName).toLowerCase() || ".png";
  const safeExt = ext.startsWith(".") ? ext : `.${ext}`;
  const filename = `${nanoid()}${safeExt}`;
  fs.writeFileSync(path.join(assetsDir, filename), buffer);
  return filename;
}
