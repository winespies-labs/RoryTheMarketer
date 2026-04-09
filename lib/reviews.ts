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
  /** Saved as a favorite in Context Hub. */
  starred?: boolean;
  /** User-assigned topics for filtering (e.g. Locker, Customer service). */
  topics?: string[];
}

/** Suggested labels when tagging reviews (add more anytime in code). */
export const REVIEW_TOPIC_PRESETS: readonly string[] = [
  "Locker",
  "Customer service",
  "Shipping & delivery",
  "Wine quality",
  "Value / pricing",
  "Website / app",
  "Returns",
];

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
  rating?: number;
  starred?: boolean;
  topics?: string[];
}

/** For upload: minimal shape per review. */
export interface ReviewUploadItem {
  title?: string;
  content: string;
  author?: string;
}
