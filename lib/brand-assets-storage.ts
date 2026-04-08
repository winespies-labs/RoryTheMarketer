import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import type { BrandAssetEntry as BrandAssetRow } from "@prisma/client";
import { getBrandDataDir, ensureBrandDataDir } from "@/lib/brands";
import { useDatabase as databaseStorageEnabled } from "@/lib/database";
import { getPrisma } from "@/lib/prisma";
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

function readBrandAssetsFs(brandId: string): BrandAssetsData {
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

function writeBrandAssetsFs(brandId: string, data: BrandAssetsData): void {
  ensureBrandDataDir(brandId);
  const next: BrandAssetsData = {
    ...data,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(getDataPath(brandId), JSON.stringify(next, null, 2), "utf-8");
}

function rowToAsset(row: BrandAssetRow): BrandAsset {
  const hasBlob = row.imageData != null && row.imageData.length > 0;
  const hasDiskName = Boolean(row.filename?.trim());
  return {
    id: row.id,
    label: row.label,
    category: row.category as AssetCategory,
    filename: row.filename ?? "",
    originalName: row.originalName ?? undefined,
    uploadedAt: row.uploadedAt.toISOString(),
    hasStoredImage: hasBlob || hasDiskName,
  };
}

const MIME_BY_EXT: Record<string, string> = {
  ".png": "image/png",
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".webp": "image/webp",
  ".gif": "image/gif",
};

function mimeFromFilename(name: string): string {
  const ext = path.extname(name).toLowerCase();
  return MIME_BY_EXT[ext] || "image/png";
}

// ——— public API ———

export async function readBrandAssets(brandId: string): Promise<BrandAssetsData> {
  if (!databaseStorageEnabled()) {
    return readBrandAssetsFs(brandId);
  }
  const prisma = getPrisma();
  const rows = await prisma.brandAssetEntry.findMany({
    where: { brandId },
    orderBy: { uploadedAt: "asc" },
  });
  const assets = rows.map(rowToAsset);
  const updatedAt =
    rows.length > 0 ? rows[rows.length - 1]!.uploadedAt.toISOString() : new Date().toISOString();
  return { updatedAt, assets };
}

export async function addBrandAsset(
  brandId: string,
  item: {
    label: string;
    category: AssetCategory;
    originalName?: string;
    file: { buffer: Buffer; originalFilename: string };
  }
): Promise<BrandAsset> {
  const id = nanoid();
  const uploadedAt = new Date();

  if (!databaseStorageEnabled()) {
    const filename = saveBrandAssetFile(brandId, item.file.buffer, item.file.originalFilename);
    const data = readBrandAssetsFs(brandId);
    const newAsset: BrandAsset = {
      id,
      label: item.label,
      category: item.category,
      filename,
      originalName: item.originalName,
      uploadedAt: uploadedAt.toISOString(),
      hasStoredImage: true,
    };
    data.assets.push(newAsset);
    writeBrandAssetsFs(brandId, data);
    return newAsset;
  }

  const prisma = getPrisma();
  const mime = mimeFromFilename(item.file.originalFilename);
  await prisma.brandAssetEntry.create({
    data: {
      id,
      brandId,
      label: item.label,
      category: item.category,
      filename: null,
      imageData: new Uint8Array(item.file.buffer),
      imageMime: mime,
      originalName: item.originalName ?? null,
      uploadedAt,
    },
  });
  const row = await prisma.brandAssetEntry.findUniqueOrThrow({ where: { id } });
  return rowToAsset(row);
}

export async function deleteBrandAsset(brandId: string, id: string): Promise<boolean> {
  if (!databaseStorageEnabled()) {
    const data = readBrandAssetsFs(brandId);
    const asset = data.assets.find((a) => a.id === id);
    if (!asset) return false;
    const imagePath = path.join(getAssetsDir(brandId), asset.filename);
    if (asset.filename && fs.existsSync(imagePath)) {
      try {
        fs.unlinkSync(imagePath);
      } catch {
        // ignore
      }
    }
    data.assets = data.assets.filter((a) => a.id !== id);
    writeBrandAssetsFs(brandId, data);
    return true;
  }
  const prisma = getPrisma();
  const res = await prisma.brandAssetEntry.deleteMany({ where: { id, brandId } });
  return res.count > 0;
}

export async function getBrandAssetById(brandId: string, id: string): Promise<BrandAsset | null> {
  if (!databaseStorageEnabled()) {
    const data = readBrandAssetsFs(brandId);
    return data.assets.find((a) => a.id === id) ?? null;
  }
  const prisma = getPrisma();
  const row = await prisma.brandAssetEntry.findFirst({ where: { id, brandId } });
  return row ? rowToAsset(row) : null;
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

/** Image bytes for serving or Gemini (DB blob or legacy disk file). */
export async function getBrandAssetImageBytes(
  brandId: string,
  asset: BrandAsset
): Promise<{ buffer: Buffer; mime: string } | null> {
  if (!databaseStorageEnabled()) {
    if (!asset.filename) return null;
    const imagePath = path.join(getAssetsDir(brandId), asset.filename);
    if (!fs.existsSync(imagePath)) return null;
    const ext = path.extname(imagePath).toLowerCase();
    return {
      buffer: fs.readFileSync(imagePath),
      mime: MIME_BY_EXT[ext] || "image/png",
    };
  }

  const prisma = getPrisma();
  const row = await prisma.brandAssetEntry.findFirst({
    where: { id: asset.id, brandId },
    select: { imageData: true, imageMime: true, filename: true },
  });
  if (row?.imageData && row.imageData.length > 0) {
    return {
      buffer: Buffer.from(row.imageData),
      mime: row.imageMime?.trim() || "image/png",
    };
  }
  if (row?.filename) {
    const imagePath = path.join(getAssetsDir(brandId), row.filename);
    if (!fs.existsSync(imagePath)) return null;
    const ext = path.extname(imagePath).toLowerCase();
    return {
      buffer: fs.readFileSync(imagePath),
      mime: MIME_BY_EXT[ext] || "image/png",
    };
  }
  return null;
}
