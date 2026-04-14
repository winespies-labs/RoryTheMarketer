// Ad Builder types and constants

// --- Ad Type System ---

export type AdType = "pdp" | "testimonial" | "comparison" | "offer" | "ugc" | "lifestyle" | "usp";

export interface AdTypeConfig {
  label: string;
  color: string;
  textColor: string;
  description: string;
  fields: string[];
}

export const AD_TYPE_CONFIG: Record<AdType, AdTypeConfig> = {
  pdp: {
    label: "PDP / Product Hero",
    color: "bg-violet-100 border-violet-300",
    textColor: "text-violet-800",
    description: "Product detail page hero ad with score, pricing, and CTA",
    fields: ["headline", "score", "pullQuote", "retailPrice", "salePrice", "promoCode", "ctaText"],
  },
  testimonial: {
    label: "Testimonial / Review",
    color: "bg-amber-100 border-amber-300",
    textColor: "text-amber-800",
    description: "Social proof ad featuring a customer or critic review",
    fields: ["reviewerName", "quoteText", "starRating", "productName", "headline"],
  },
  comparison: {
    label: "Us vs Them",
    color: "bg-blue-100 border-blue-300",
    textColor: "text-blue-800",
    description: "Side-by-side comparison highlighting value or quality",
    fields: ["headline", "comparisonPoint", "retailPrice", "salePrice", "differentiators", "ctaText"],
  },
  offer: {
    label: "Offer / Promo",
    color: "bg-red-100 border-red-300",
    textColor: "text-red-800",
    description: "Time-sensitive promotion with urgency elements",
    fields: ["headline", "retailPrice", "salePrice", "promoCode", "urgencyText", "ctaText"],
  },
  ugc: {
    label: "UGC-Style",
    color: "bg-green-100 border-green-300",
    textColor: "text-green-800",
    description: "Casual, user-generated content style ad",
    fields: ["casualCopy", "productMention", "lifestyleContext", "headline"],
  },
  lifestyle: {
    label: "Lifestyle / Brand",
    color: "bg-pink-100 border-pink-300",
    textColor: "text-pink-800",
    description: "Brand awareness or lifestyle ad — not product-specific",
    fields: ["headline", "tagline", "ctaText", "briefDescription"],
  },
  usp: {
    label: "USP / Brand Statement",
    color: "bg-indigo-100 border-indigo-300",
    textColor: "text-indigo-800",
    description: "Unique selling proposition or brand statement ad",
    fields: ["headline", "usp", "ctaText"],
  },
};

// --- Aspect Ratio ---

export type AspectRatio = "1:1" | "4:5" | "9:16" | "16:9";

export interface AspectRatioConfig {
  width: number;
  height: number;
  label: string;
}

export const ASPECT_RATIO_CONFIG: Record<AspectRatio, AspectRatioConfig> = {
  "1:1": { width: 1080, height: 1080, label: "Square (1:1)" },
  "4:5": { width: 1080, height: 1350, label: "Portrait (4:5)" },
  "9:16": { width: 1080, height: 1920, label: "Story (9:16)" },
  "16:9": { width: 1920, height: 1080, label: "Landscape (16:9)" },
};

// --- Image Backend ---

export type ImageBackend = "gemini" | "fal";

// --- Copy Variation ---

export interface CopyVariation {
  primaryText: string;
  headline: string;
  description: string;
}

// --- Image Generation Settings ---

export interface ImageGenerationSettings {
  backend: ImageBackend;
  aspectRatio: AspectRatio;
  imagesPerPrompt: number;
}

// --- Core Types ---

export interface AdStyle {
  id: string;
  name: string;
  filename: string;
  addedAt: string;
}

export interface AdStylesData {
  updatedAt: string;
  styles: AdStyle[];
}

export interface GeneratedAd {
  id: string;
  styleId: string;
  styleName: string;
  filename: string;
  wineDetails: WineDetails;
  createdAt: string;
  referenceAdId?: string;
  copyVariation?: CopyVariation;
  aspectRatio?: AspectRatio;
  backend?: ImageBackend;
}

export interface GenerationsData {
  updatedAt: string;
  generations: GeneratedAd[];
}

export interface WineDetails {
  headline: string;
  score?: string;
  pullQuote?: string;
  retailPrice?: string;
  salePrice?: string;
  promoCode?: string;
  ctaText?: string;
  additionalNotes?: string;
  // Testimonial fields
  reviewerName?: string;
  quoteText?: string;
  starRating?: string;
  productName?: string;
  // Comparison fields
  comparisonPoint?: string;
  differentiators?: string;
  // Offer fields
  urgencyText?: string;
  // UGC fields
  casualCopy?: string;
  productMention?: string;
  lifestyleContext?: string;
  // Lifestyle fields
  tagline?: string;
  briefDescription?: string;
}

export const STYLES_FILENAME = "styles.json";
export const GENERATIONS_FILENAME = "generations.json";
export const AD_BUILDER_DIR = "ad-builder";
export const STYLES_SUBDIR = "styles";
export const UPLOADS_SUBDIR = "uploads";
export const GENERATED_SUBDIR = "generated";
