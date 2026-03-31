import fs from "fs";
import path from "path";
import { getBrandDataDir, ensureBrandDataDir } from "@/lib/brands";
import type { ForeplayAd } from "@/lib/foreplay";
import type { AdsLibraryAd } from "@/lib/ads-library";

export const FOREPLAY_ADS_FILENAME = "foreplay-ads.json";
export const ADS_LIBRARY_RESULTS_FILENAME = "ads-library-results.json";

export interface ForeplayAdsData {
  syncedAt: string;
  ads: ForeplayAd[];
}

export interface AdsLibraryResultsData {
  searchedAt: string;
  query: string;
  countries?: string[];
  results: AdsLibraryAd[];
}

function foreplayPath(brandId: string): string {
  return path.join(getBrandDataDir(brandId), FOREPLAY_ADS_FILENAME);
}

function adsLibraryPath(brandId: string): string {
  return path.join(getBrandDataDir(brandId), ADS_LIBRARY_RESULTS_FILENAME);
}

export function readForeplayAds(brandId: string): ForeplayAdsData {
  const filePath = foreplayPath(brandId);
  if (!fs.existsSync(filePath)) return { syncedAt: "", ads: [] };
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw) as ForeplayAdsData;
    return {
      syncedAt: data.syncedAt ?? "",
      ads: Array.isArray(data.ads) ? data.ads : [],
    };
  } catch {
    return { syncedAt: "", ads: [] };
  }
}

export function writeForeplayAds(brandId: string, data: ForeplayAdsData): void {
  ensureBrandDataDir(brandId);
  fs.writeFileSync(foreplayPath(brandId), JSON.stringify(data, null, 2), "utf-8");
}

export function readAdsLibraryResults(brandId: string): AdsLibraryResultsData {
  const filePath = adsLibraryPath(brandId);
  if (!fs.existsSync(filePath)) return { searchedAt: "", query: "", results: [] };
  try {
    const raw = fs.readFileSync(filePath, "utf-8");
    const data = JSON.parse(raw) as AdsLibraryResultsData;
    return {
      searchedAt: data.searchedAt ?? "",
      query: data.query ?? "",
      countries: data.countries,
      results: Array.isArray(data.results) ? data.results : [],
    };
  } catch {
    return { searchedAt: "", query: "", results: [] };
  }
}

export function writeAdsLibraryResults(brandId: string, data: AdsLibraryResultsData): void {
  ensureBrandDataDir(brandId);
  fs.writeFileSync(adsLibraryPath(brandId), JSON.stringify(data, null, 2), "utf-8");
}
