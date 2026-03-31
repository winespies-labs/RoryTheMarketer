export type CtaType =
  | "SHOP_NOW"
  | "LEARN_MORE"
  | "SIGN_UP"
  | "ORDER_NOW"
  | "GET_OFFER"
  | "BOOK_NOW";

export const CTA_OPTIONS: { value: CtaType; label: string }[] = [
  { value: "SHOP_NOW", label: "Shop Now" },
  { value: "LEARN_MORE", label: "Learn More" },
  { value: "SIGN_UP", label: "Sign Up" },
  { value: "ORDER_NOW", label: "Order Now" },
  { value: "GET_OFFER", label: "Get Offer" },
  { value: "BOOK_NOW", label: "Book Now" },
];

export interface AdElements {
  headline: string;
  primaryText: string;
  description: string;
  ctaType: CtaType;
  destinationUrl: string;
}

export interface CreativeImage {
  id: string;
  base64: string;
  mimeType: string;
  prompt?: string;
}

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
}
