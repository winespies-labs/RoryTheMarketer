import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { getBrandDataDir, ensureBrandDataDir } from "@/lib/brands";

export interface DrillJournalEntry {
  id: string;
  techniqueId: string;
  techniqueLabel: string;
  drillId: string;
  drillTitle: string;
  mechanism: string;
  originalSwipe: string;
  userVersion: string;
  savedAt: string;
  contextLibraryItemId?: string;
}

interface DrillJournalData {
  entries: DrillJournalEntry[];
}

const FILENAME = "drill-journal.json";

function getFilePath(brandId: string): string {
  return path.join(getBrandDataDir(brandId), FILENAME);
}

export function readDrillJournal(brandId: string): DrillJournalData {
  const filePath = getFilePath(brandId);
  if (!fs.existsSync(filePath)) return { entries: [] };
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw) as DrillJournalData;
    if (!Array.isArray(data?.entries)) return { entries: [] };
    return data;
  } catch {
    return { entries: [] };
  }
}

function writeData(brandId: string, data: DrillJournalData): void {
  ensureBrandDataDir(brandId);
  fs.writeFileSync(getFilePath(brandId), JSON.stringify(data, null, 2), "utf-8");
}

export function addDrillJournalEntry(
  brandId: string,
  input: Omit<DrillJournalEntry, "id" | "savedAt">
): DrillJournalEntry {
  const data = readDrillJournal(brandId);
  const entry: DrillJournalEntry = {
    ...input,
    id: nanoid(),
    savedAt: new Date().toISOString(),
  };
  data.entries.push(entry);
  writeData(brandId, data);
  return entry;
}

export function deleteDrillJournalEntry(brandId: string, id: string): boolean {
  const data = readDrillJournal(brandId);
  const prev = data.entries.length;
  data.entries = data.entries.filter((e) => e.id !== id);
  if (data.entries.length === prev) return false;
  writeData(brandId, data);
  return true;
}
