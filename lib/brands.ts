import path from "path";
import fs from "fs";

export type BrandId = string;

export interface Brand {
  id: BrandId;
  name: string;
  domain?: string;
  metaAdAccountId?: string;
  metaPageId?: string;
}

export const BRANDS: Brand[] = [
  {
    id: "winespies",
    name: "Wine Spies",
    domain: "winespies.com",
    metaAdAccountId: process.env.META_AD_ACCOUNT_ID,
    metaPageId: process.env.META_PAGE_ID,
  },
];

const projectRoot = process.cwd();

export function getBrandContextDir(brandId: BrandId): string {
  // Default brand reads from root context/
  if (brandId === BRANDS[0]?.id) {
    return path.join(projectRoot, "context");
  }
  return path.join(projectRoot, "context", "brands", brandId);
}

export function getBrandDataDir(brandId: BrandId): string {
  return path.join(projectRoot, "data", brandId);
}

export function ensureBrandDataDir(brandId: BrandId): string {
  const dir = getBrandDataDir(brandId);
  fs.mkdirSync(dir, { recursive: true });
  return dir;
}

export function getBrand(brandId: BrandId): Brand | undefined {
  return BRANDS.find((b) => b.id === brandId);
}
