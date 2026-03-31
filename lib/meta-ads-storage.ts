import fs from "fs";
import path from "path";
import { ensureBrandDataDir, getBrandDataDir } from "@/lib/brands";
import {
  META_CAMPAIGNS_FILENAME,
  META_ADSETS_FILENAME,
  META_ADS_FILENAME,
  type MetaCampaignsData,
  type MetaAdSetsData,
  type MetaAdsData,
} from "@/lib/meta-ads";

// ── Paths ──

function campaignsPath(brandId: string): string {
  return path.join(getBrandDataDir(brandId), META_CAMPAIGNS_FILENAME);
}

function adsetsPath(brandId: string): string {
  return path.join(getBrandDataDir(brandId), META_ADSETS_FILENAME);
}

function adsPath(brandId: string): string {
  return path.join(getBrandDataDir(brandId), META_ADS_FILENAME);
}

// ── Campaigns ──

export function readMetaCampaigns(brandId: string): MetaCampaignsData | null {
  const filePath = campaignsPath(brandId);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as MetaCampaignsData;
    if (!parsed || !Array.isArray(parsed.campaigns)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeMetaCampaigns(brandId: string, data: MetaCampaignsData): void {
  ensureBrandDataDir(brandId);
  fs.writeFileSync(campaignsPath(brandId), JSON.stringify(data, null, 2), "utf-8");
}

// ── Ad Sets ──

export function readMetaAdSets(brandId: string): MetaAdSetsData | null {
  const filePath = adsetsPath(brandId);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as MetaAdSetsData;
    if (!parsed || !Array.isArray(parsed.adsets)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeMetaAdSets(brandId: string, data: MetaAdSetsData): void {
  ensureBrandDataDir(brandId);
  fs.writeFileSync(adsetsPath(brandId), JSON.stringify(data, null, 2), "utf-8");
}

// ── Ads ──

export function readMetaAds(brandId: string): MetaAdsData | null {
  const filePath = adsPath(brandId);
  if (!fs.existsSync(filePath)) return null;
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const parsed = JSON.parse(raw) as MetaAdsData;
    if (!parsed || !Array.isArray(parsed.ads)) return null;
    return parsed;
  } catch {
    return null;
  }
}

export function writeMetaAds(brandId: string, data: MetaAdsData): void {
  ensureBrandDataDir(brandId);
  fs.writeFileSync(adsPath(brandId), JSON.stringify(data, null, 2), "utf-8");
}
