/**
 * Instagram Research — types and constants.
 */

export interface InstagramPost {
  id: string;
  shortCode: string;
  url: string;
  type: "Image" | "Video" | "Sidecar";
  caption: string;
  ownerUsername: string;
  ownerFullName?: string;
  likesCount: number;
  commentsCount: number;
  videoViewCount?: number;
  videoUrl?: string;
  displayUrl: string;
  timestamp: string;
  hashtags?: string[];
  mentions?: string[];
  transcript?: string;
  transcribedAt?: string;
}

export interface InstagramSearch {
  id: string;
  keyword: string;
  searchedAt: string;
  resultCount: number;
  posts: InstagramPost[];
}

export interface InstagramResearchData {
  updatedAt: string;
  searches: InstagramSearch[];
}

export const INSTAGRAM_RESEARCH_FILENAME = "instagram-research.json";
