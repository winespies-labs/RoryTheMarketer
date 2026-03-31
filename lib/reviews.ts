/** Source of the review (Slack messages may be tagged or we infer from text). */
export type ReviewSource = "trustpilot" | "app_store" | "unknown";

export interface Review {
  id: string;
  source: ReviewSource;
  title?: string;
  content: string;
  author?: string;
  rating?: number;
  /** When the review was created (from platform or first seen). */
  createdAt: string;
  /** Slack message ts — used to dedupe when syncing from Slack. */
  slackMessageTs?: string;
}

export interface ReviewsData {
  updatedAt: string;
  /** Channel ID last synced (for display). */
  slackChannelId?: string;
  reviews: Review[];
}

export const REVIEWS_FILENAME = "reviews.json";

/** Shape returned by GET /api/reviews for pickers and briefs (title + content). */
export interface ReviewSnippet {
  id: string;
  title?: string;
  content: string;
  source?: ReviewSource;
}

/** For upload: minimal shape per review. */
export interface ReviewUploadItem {
  title?: string;
  content: string;
  author?: string;
}
