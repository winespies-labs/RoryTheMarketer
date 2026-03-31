import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { getBrandDataDir, ensureBrandDataDir } from "@/lib/brands";
import { useDatabase } from "@/lib/database";
import { getPrisma } from "@/lib/prisma";
import {
  type SwipeInspirationData,
  type SwipeInspirationItem,
  type SwipeInspirationType,
  type SwipeStyle,
  type SwipeCategory,
  SWIPE_INSPIRATION_FILENAME,
  SWIPE_INSPIRATION_ASSETS_DIR,
} from "@/lib/swipe-inspiration";
import type { SwipeInspirationEntry as SwipeRow } from "@prisma/client";

function getDataPath(brandId: string): string {
  return path.join(getBrandDataDir(brandId), SWIPE_INSPIRATION_FILENAME);
}

export function getAssetsDir(brandId: string): string {
  return path.join(getBrandDataDir(brandId), SWIPE_INSPIRATION_ASSETS_DIR);
}

function defaultData(): SwipeInspirationData {
  return { updatedAt: new Date().toISOString(), items: [] };
}

function rowToItem(row: SwipeRow): SwipeInspirationItem {
  const hasBlob = row.imageData != null && row.imageData.length > 0;
  return {
    id: row.id,
    type: row.type as SwipeInspirationType,
    content: row.content,
    title: row.title ?? undefined,
    style: (row.style as SwipeStyle | null) ?? undefined,
    category: (row.category as SwipeCategory | null) ?? undefined,
    tags: Array.isArray(row.tags) ? (row.tags as unknown[]).map(String) : undefined,
    imageFile: row.imageFile ?? undefined,
    hasStoredImage: hasBlob || undefined,
    useInContext: row.useInContext,
    addedAt: row.addedAt.toISOString(),
  };
}

// ——— filesystem ———

function readSwipeInspirationFs(brandId: string): SwipeInspirationData {
  const filePath = getDataPath(brandId);
  if (!fs.existsSync(filePath)) return defaultData();
  const raw = fs.readFileSync(filePath, "utf-8");
  try {
    const data = JSON.parse(raw) as SwipeInspirationData;
    if (!Array.isArray(data?.items)) return defaultData();
    return { updatedAt: data.updatedAt ?? "", items: data.items };
  } catch {
    return defaultData();
  }
}

function writeSwipeInspirationFs(brandId: string, data: SwipeInspirationData): void {
  ensureBrandDataDir(brandId);
  const next: SwipeInspirationData = {
    ...data,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(getDataPath(brandId), JSON.stringify(next, null, 2), "utf-8");
}

// ——— public API ———

export async function readSwipeInspiration(brandId: string): Promise<SwipeInspirationData> {
  if (!useDatabase()) {
    return readSwipeInspirationFs(brandId);
  }
  const prisma = getPrisma();
  const rows = await prisma.swipeInspirationEntry.findMany({
    where: { brandId },
    orderBy: { addedAt: "asc" },
  });
  const items = rows.map(rowToItem);
  const updatedAt =
    rows.length > 0 ? rows[rows.length - 1]!.addedAt.toISOString() : new Date().toISOString();
  return { updatedAt, items };
}

export type AddSwipeImagePayload = { buffer: Buffer; mime: string };

export async function addSwipeInspirationItem(
  brandId: string,
  item: {
    type: SwipeInspirationType;
    content: string;
    title?: string;
    style?: SwipeStyle;
    category?: SwipeCategory;
    tags?: string[];
    imageFile?: string;
    imagePayload?: AddSwipeImagePayload;
    useInContext?: boolean;
    id?: string;
  }
): Promise<SwipeInspirationItem> {
  const id = item.id ?? nanoid();
  const addedAt = new Date();

  if (!useDatabase()) {
    const data = readSwipeInspirationFs(brandId);
    const newItem: SwipeInspirationItem = {
      id,
      type: item.type,
      content: item.content,
      title: item.title,
      style: item.style,
      category: item.category,
      tags: item.tags,
      imageFile: item.imageFile,
      useInContext: item.useInContext ?? false,
      addedAt: addedAt.toISOString(),
    };
    data.items.push(newItem);
    writeSwipeInspirationFs(brandId, data);
    return newItem;
  }

  const prisma = getPrisma();
  await prisma.swipeInspirationEntry.create({
    data: {
      id,
      brandId,
      type: item.type,
      content: item.content,
      title: item.title ?? null,
      style: item.style ?? null,
      category: item.category ?? null,
      tags: item.tags === undefined ? undefined : (item.tags as object),
      imageFile: item.imageFile ?? null,
      imageData: item.imagePayload
        ? new Uint8Array(item.imagePayload.buffer)
        : null,
      imageMime: item.imagePayload?.mime ?? null,
      useInContext: item.useInContext ?? false,
      addedAt,
    },
  });
  const row = await prisma.swipeInspirationEntry.findUniqueOrThrow({ where: { id } });
  return rowToItem(row);
}

export async function updateSwipeInspirationItem(
  brandId: string,
  id: string,
  updates: Partial<
    Pick<
      SwipeInspirationItem,
      "title" | "content" | "style" | "category" | "tags" | "useInContext"
    >
  >
): Promise<SwipeInspirationItem | null> {
  if (!useDatabase()) {
    const data = readSwipeInspirationFs(brandId);
    const index = data.items.findIndex((i) => i.id === id);
    if (index === -1) return null;
    data.items[index] = { ...data.items[index], ...updates };
    writeSwipeInspirationFs(brandId, data);
    return data.items[index];
  }
  const prisma = getPrisma();
  const existing = await prisma.swipeInspirationEntry.findFirst({
    where: { id, brandId },
  });
  if (!existing) return null;
  await prisma.swipeInspirationEntry.update({
    where: { id },
    data: {
      title: updates.title !== undefined ? updates.title : existing.title,
      content: updates.content ?? existing.content,
      style: updates.style !== undefined ? updates.style : existing.style,
      category: updates.category !== undefined ? updates.category : existing.category,
      tags:
        updates.tags !== undefined
          ? (updates.tags as object)
          : (existing.tags as object | undefined),
      useInContext:
        updates.useInContext !== undefined ? updates.useInContext : existing.useInContext,
    },
  });
  const row = await prisma.swipeInspirationEntry.findUniqueOrThrow({ where: { id } });
  return rowToItem(row);
}

export async function deleteSwipeInspirationItem(
  brandId: string,
  id: string
): Promise<boolean> {
  if (!useDatabase()) {
    const data = readSwipeInspirationFs(brandId);
    const item = data.items.find((i) => i.id === id);
    if (!item) return false;
    if (item.imageFile) {
      const assetsDir = getAssetsDir(brandId);
      const imagePath = path.join(assetsDir, item.imageFile);
      if (fs.existsSync(imagePath)) {
        try {
          fs.unlinkSync(imagePath);
        } catch {
          // ignore
        }
      }
    }
    data.items = data.items.filter((i) => i.id !== id);
    writeSwipeInspirationFs(brandId, data);
    return true;
  }
  const prisma = getPrisma();
  const res = await prisma.swipeInspirationEntry.deleteMany({ where: { id, brandId } });
  return res.count > 0;
}

export async function getSwipeInspirationItemById(
  brandId: string,
  id: string
): Promise<SwipeInspirationItem | null> {
  if (!useDatabase()) {
    const data = readSwipeInspirationFs(brandId);
    return data.items.find((i) => i.id === id) ?? null;
  }
  const prisma = getPrisma();
  const row = await prisma.swipeInspirationEntry.findFirst({
    where: { id, brandId },
  });
  return row ? rowToItem(row) : null;
}

/** Legacy: filesystem path for image. Null when using DB-stored bytes. */
export function getSwipeInspirationImagePath(
  brandId: string,
  item: SwipeInspirationItem
): string | null {
  if (item.type !== "image" || !item.imageFile) return null;
  const fullPath = path.join(getAssetsDir(brandId), item.imageFile);
  return fs.existsSync(fullPath) ? fullPath : null;
}

/** Image bytes for GET /api/swipe-inspiration/image (DB or disk). */
export async function getSwipeInspirationImageBytes(
  brandId: string,
  item: SwipeInspirationItem
): Promise<{ buffer: Buffer; mime: string } | null> {
  if (item.type !== "image") return null;

  if (useDatabase()) {
    const prisma = getPrisma();
    const row = await prisma.swipeInspirationEntry.findFirst({
      where: { id: item.id, brandId },
      select: { imageData: true, imageMime: true, imageFile: true },
    });
    if (row?.imageData && row.imageData.length > 0) {
      return {
        buffer: Buffer.from(row.imageData),
        mime: row.imageMime?.trim() || "image/png",
      };
    }
    if (row?.imageFile) {
      const legacyItem: SwipeInspirationItem = { ...item, imageFile: row.imageFile };
      const p = getSwipeInspirationImagePath(brandId, legacyItem);
      if (!p) return null;
      const ext = path.extname(p).toLowerCase();
      const mimeMap: Record<string, string> = {
        ".png": "image/png",
        ".jpg": "image/jpeg",
        ".jpeg": "image/jpeg",
        ".webp": "image/webp",
        ".gif": "image/gif",
      };
      return { buffer: fs.readFileSync(p), mime: mimeMap[ext] || "image/png" };
    }
    return null;
  }

  const p = getSwipeInspirationImagePath(brandId, item);
  if (!p) return null;
  const ext = path.extname(p).toLowerCase();
  const mimeMap: Record<string, string> = {
    ".png": "image/png",
    ".jpg": "image/jpeg",
    ".jpeg": "image/jpeg",
    ".webp": "image/webp",
    ".gif": "image/gif",
  };
  return { buffer: fs.readFileSync(p), mime: mimeMap[ext] || "image/png" };
}
