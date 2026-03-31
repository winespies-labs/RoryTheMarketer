import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { getBrandDataDir, ensureBrandDataDir } from "@/lib/brands";
import { useDatabase } from "@/lib/database";
import { getPrisma } from "@/lib/prisma";
import {
  type ContextLibraryData,
  type ContextLibraryItem,
  type ContextLibraryItemType,
  CONTEXT_LIBRARY_FILENAME,
} from "@/lib/context-library";
import type { ContextLibraryEntry as CtxRow } from "@prisma/client";

function getFilePath(brandId: string): string {
  return path.join(getBrandDataDir(brandId), CONTEXT_LIBRARY_FILENAME);
}

function defaultData(): ContextLibraryData {
  return { updatedAt: new Date().toISOString(), items: [] };
}

function rowToItem(row: CtxRow): ContextLibraryItem {
  return {
    id: row.id,
    type: row.type as ContextLibraryItemType,
    title: row.title ?? undefined,
    content: row.content,
    meta: (row.meta as Record<string, unknown> | null) ?? undefined,
    tags: Array.isArray(row.tags) ? (row.tags as unknown[]).map(String) : undefined,
    addedAt: row.addedAt.toISOString(),
  };
}

// ——— filesystem (no DATABASE_URL) ———

function readContextLibraryFs(brandId: string): ContextLibraryData {
  const filePath = getFilePath(brandId);
  if (!fs.existsSync(filePath)) return defaultData();
  const raw = fs.readFileSync(filePath, "utf-8");
  try {
    const data = JSON.parse(raw) as ContextLibraryData;
    if (!Array.isArray(data?.items)) return defaultData();
    return { updatedAt: data.updatedAt ?? "", items: data.items };
  } catch {
    return defaultData();
  }
}

function writeContextLibraryFs(brandId: string, data: ContextLibraryData): void {
  ensureBrandDataDir(brandId);
  const filePath = getFilePath(brandId);
  const next: ContextLibraryData = {
    ...data,
    updatedAt: new Date().toISOString(),
  };
  fs.writeFileSync(filePath, JSON.stringify(next, null, 2), "utf-8");
}

// ——— public API ———

export async function readContextLibrary(brandId: string): Promise<ContextLibraryData> {
  if (!useDatabase()) {
    return readContextLibraryFs(brandId);
  }
  const prisma = getPrisma();
  const rows = await prisma.contextLibraryEntry.findMany({
    where: { brandId },
    orderBy: { addedAt: "asc" },
  });
  const items = rows.map(rowToItem);
  const updatedAt =
    rows.length > 0 ? rows[rows.length - 1]!.addedAt.toISOString() : new Date().toISOString();
  return { updatedAt, items };
}

export async function writeContextLibrary(
  brandId: string,
  data: ContextLibraryData
): Promise<void> {
  if (!useDatabase()) {
    writeContextLibraryFs(brandId, data);
    return;
  }
  const prisma = getPrisma();
  const BATCH = 100;
  await prisma.$transaction(async (tx) => {
    await tx.contextLibraryEntry.deleteMany({ where: { brandId } });
    if (data.items.length === 0) return;
    for (let i = 0; i < data.items.length; i += BATCH) {
      const chunk = data.items.slice(i, i + BATCH);
      await tx.contextLibraryEntry.createMany({
        data: chunk.map((item) => ({
          id: item.id,
          brandId,
          type: item.type,
          title: item.title ?? null,
          content: item.content,
          meta: item.meta === undefined ? undefined : (item.meta as object),
          tags: item.tags === undefined ? undefined : (item.tags as object),
          addedAt: new Date(item.addedAt),
        })),
      });
    }
  });
}

export async function addContextLibraryItem(
  brandId: string,
  item: {
    type: ContextLibraryItemType;
    title?: string;
    content: string;
    meta?: Record<string, unknown>;
    tags?: string[];
  }
): Promise<ContextLibraryItem> {
  if (!useDatabase()) {
    const data = readContextLibraryFs(brandId);
    const newItem: ContextLibraryItem = {
      id: nanoid(),
      type: item.type,
      title: item.title,
      content: item.content,
      meta: item.meta,
      tags: item.tags,
      addedAt: new Date().toISOString(),
    };
    data.items.push(newItem);
    writeContextLibraryFs(brandId, data);
    return newItem;
  }
  const prisma = getPrisma();
  const id = nanoid();
  const addedAt = new Date();
  await prisma.contextLibraryEntry.create({
    data: {
      id,
      brandId,
      type: item.type,
      title: item.title ?? null,
      content: item.content,
      meta: item.meta === undefined ? undefined : (item.meta as object),
      tags: item.tags === undefined ? undefined : (item.tags as object),
      addedAt,
    },
  });
  return {
    id,
    type: item.type,
    title: item.title,
    content: item.content,
    meta: item.meta,
    tags: item.tags,
    addedAt: addedAt.toISOString(),
  };
}

export async function updateContextLibraryItem(
  brandId: string,
  id: string,
  updates: Partial<Pick<ContextLibraryItem, "type" | "title" | "content" | "meta" | "tags">>
): Promise<ContextLibraryItem | null> {
  if (!useDatabase()) {
    const data = readContextLibraryFs(brandId);
    const index = data.items.findIndex((i) => i.id === id);
    if (index === -1) return null;
    data.items[index] = { ...data.items[index], ...updates };
    writeContextLibraryFs(brandId, data);
    return data.items[index];
  }
  const prisma = getPrisma();
  const existing = await prisma.contextLibraryEntry.findFirst({
    where: { id, brandId },
  });
  if (!existing) return null;
  await prisma.contextLibraryEntry.update({
    where: { id },
    data: {
      type: updates.type ?? existing.type,
      title: updates.title !== undefined ? updates.title : existing.title,
      content: updates.content ?? existing.content,
      meta:
        updates.meta !== undefined
          ? (updates.meta as object)
          : (existing.meta as object | undefined),
      tags:
        updates.tags !== undefined
          ? (updates.tags as object)
          : (existing.tags as object | undefined),
    },
  });
  const row = await prisma.contextLibraryEntry.findUniqueOrThrow({ where: { id } });
  return rowToItem(row);
}

export async function deleteContextLibraryItem(
  brandId: string,
  id: string
): Promise<boolean> {
  if (!useDatabase()) {
    const data = readContextLibraryFs(brandId);
    const prev = data.items.length;
    data.items = data.items.filter((i) => i.id !== id);
    if (data.items.length === prev) return false;
    writeContextLibraryFs(brandId, data);
    return true;
  }
  const prisma = getPrisma();
  const res = await prisma.contextLibraryEntry.deleteMany({ where: { id, brandId } });
  return res.count > 0;
}

export async function getContextLibraryItemsByIds(
  brandId: string,
  ids: string[]
): Promise<ContextLibraryItem[]> {
  if (ids.length === 0) return [];
  if (!useDatabase()) {
    const data = readContextLibraryFs(brandId);
    const set = new Set(ids);
    return data.items.filter((i) => set.has(i.id));
  }
  const prisma = getPrisma();
  const rows = await prisma.contextLibraryEntry.findMany({
    where: { brandId, id: { in: ids } },
  });
  const map = new Map(rows.map((r) => [r.id, rowToItem(r)]));
  return ids.map((id) => map.get(id)).filter((x): x is ContextLibraryItem => x != null);
}

export async function getStarredContextLibraryItems(
  brandId: string,
  opts?: { types?: ContextLibraryItemType[]; limit?: number }
): Promise<ContextLibraryItem[]> {
  const typeSet = opts?.types?.length ? new Set(opts.types) : null;
  const limit = Math.max(1, opts?.limit ?? 5);

  if (!useDatabase()) {
    const data = readContextLibraryFs(brandId);
    return data.items
      .filter((item) => {
        const starred = item.meta?.starred === true;
        if (!starred) return false;
        if (!typeSet) return true;
        return typeSet.has(item.type);
      })
      .slice(-limit);
  }
  const prisma = getPrisma();
  const rows = await prisma.contextLibraryEntry.findMany({
    where: { brandId },
    orderBy: { addedAt: "asc" },
  });
  const items = rows.map(rowToItem);
  return items
    .filter((item) => {
      const starred = item.meta?.starred === true;
      if (!starred) return false;
      if (!typeSet) return true;
      return typeSet.has(item.type);
    })
    .slice(-limit);
}
