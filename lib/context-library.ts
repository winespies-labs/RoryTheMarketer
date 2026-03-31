export type ContextLibraryItemType =
  | "copywriting"
  | "ad_copy"
  | "brief"
  | "reference_ad"
  | "swipe";

export interface ContextLibraryItem {
  id: string;
  type: ContextLibraryItemType;
  title?: string;
  content: string;
  meta?: Record<string, unknown>;
  tags?: string[];
  addedAt: string;
}

export interface ContextLibraryData {
  updatedAt: string;
  items: ContextLibraryItem[];
}

export const CONTEXT_LIBRARY_FILENAME = "context-library.json";
