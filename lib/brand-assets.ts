/**
 * Brand Asset Library — types + constants for per-brand persistent image assets.
 */

export type AssetCategory = "logo" | "badge" | "product" | "background" | "other";

export const ASSET_CATEGORIES: { value: AssetCategory; label: string }[] = [
  { value: "logo", label: "Logo" },
  { value: "badge", label: "Badge" },
  { value: "product", label: "Product" },
  { value: "background", label: "Background" },
  { value: "other", label: "Other" },
];

export interface BrandAsset {
  id: string;
  label: string;
  category: AssetCategory;
  filename: string;
  originalName?: string;
  uploadedAt: string;
}

export interface BrandAssetsData {
  updatedAt: string;
  assets: BrandAsset[];
}

export const BRAND_ASSETS_FILENAME = "brand-assets.json";
export const BRAND_ASSETS_DIR = "brand-assets";
