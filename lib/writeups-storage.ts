import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { getBrandDataDir, ensureBrandDataDir } from "@/lib/brands";
import { useDatabase } from "@/lib/database";
import { getPrisma } from "@/lib/prisma";
import type { Writeup as WriteupRow } from "@prisma/client";

export interface Writeup {
  id: string;
  title: string;
  content: string;
  status: "draft" | "published";
  score: number | null;
  createdAt: string;
  updatedAt: string;
}

interface WriteupsData {
  writeups: Writeup[];
}

const FILENAME = "writeups.json";

function getFilePath(brandId: string): string {
  return path.join(getBrandDataDir(brandId), FILENAME);
}

function defaultData(): WriteupsData {
  return { writeups: [] };
}

function rowToWriteup(row: WriteupRow): Writeup {
  return {
    id: row.id,
    title: row.title,
    content: row.content,
    status: (row.status as "draft" | "published") || "draft",
    score: row.score ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ——— filesystem fallback ———

function readWriteupsFs(brandId: string): WriteupsData {
  const filePath = getFilePath(brandId);
  if (!fs.existsSync(filePath)) return defaultData();
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw) as WriteupsData;
    if (!Array.isArray(data?.writeups)) return defaultData();
    // Backfill defaults for legacy writeups missing status/score
    data.writeups = data.writeups.map((w) => ({
      ...w,
      status: w.status || "draft",
      score: w.score ?? null,
    }));
    return data;
  } catch {
    return defaultData();
  }
}

function writeDataFs(brandId: string, data: WriteupsData): void {
  ensureBrandDataDir(brandId);
  fs.writeFileSync(getFilePath(brandId), JSON.stringify(data, null, 2), "utf-8");
}

// ——— public API ———

export async function readWriteups(brandId: string, status?: "draft" | "published"): Promise<WriteupsData> {
  if (!useDatabase()) {
    const data = readWriteupsFs(brandId);
    if (status) {
      data.writeups = data.writeups.filter((w) => w.status === status);
    }
    return data;
  }
  const prisma = getPrisma();
  const where: Record<string, unknown> = { brandId };
  if (status) where.status = status;
  const rows = await prisma.writeup.findMany({
    where,
    orderBy: { createdAt: "desc" },
  });
  return { writeups: rows.map(rowToWriteup) };
}

export async function createWriteup(
  brandId: string,
  input: { title: string; content: string; status?: "draft" | "published"; score?: number | null }
): Promise<Writeup> {
  if (!useDatabase()) {
    const data = readWriteupsFs(brandId);
    const now = new Date().toISOString();
    const writeup: Writeup = {
      id: nanoid(),
      title: input.title,
      content: input.content,
      status: input.status || "draft",
      score: input.score ?? null,
      createdAt: now,
      updatedAt: now,
    };
    data.writeups.push(writeup);
    writeDataFs(brandId, data);
    return writeup;
  }
  const prisma = getPrisma();
  const now = new Date();
  const row = await prisma.writeup.create({
    data: {
      id: nanoid(),
      brandId,
      title: input.title,
      content: input.content,
      status: input.status || "draft",
      score: input.score ?? null,
      createdAt: now,
      updatedAt: now,
    },
  });
  return rowToWriteup(row);
}

export async function updateWriteup(
  brandId: string,
  id: string,
  updates: { title?: string; content?: string; status?: "draft" | "published"; score?: number | null }
): Promise<Writeup | null> {
  if (!useDatabase()) {
    const data = readWriteupsFs(brandId);
    const index = data.writeups.findIndex((w) => w.id === id);
    if (index === -1) return null;
    const writeup = data.writeups[index];
    if (updates.title !== undefined) writeup.title = updates.title;
    if (updates.content !== undefined) writeup.content = updates.content;
    if (updates.status !== undefined) writeup.status = updates.status;
    if (updates.score !== undefined) writeup.score = updates.score;
    writeup.updatedAt = new Date().toISOString();
    data.writeups[index] = writeup;
    writeDataFs(brandId, data);
    return writeup;
  }
  const prisma = getPrisma();
  const existing = await prisma.writeup.findFirst({ where: { id, brandId } });
  if (!existing) return null;
  const updateData: Record<string, unknown> = {
    title: updates.title ?? existing.title,
    content: updates.content ?? existing.content,
    updatedAt: new Date(),
  };
  if (updates.status !== undefined) updateData.status = updates.status;
  if (updates.score !== undefined) updateData.score = updates.score;
  const row = await prisma.writeup.update({
    where: { id },
    data: updateData,
  });
  return rowToWriteup(row);
}

export async function deleteWriteup(brandId: string, id: string): Promise<boolean> {
  if (!useDatabase()) {
    const data = readWriteupsFs(brandId);
    const prev = data.writeups.length;
    data.writeups = data.writeups.filter((w) => w.id !== id);
    if (data.writeups.length === prev) return false;
    writeDataFs(brandId, data);
    return true;
  }
  const prisma = getPrisma();
  const res = await prisma.writeup.deleteMany({ where: { id, brandId } });
  return res.count > 0;
}
