/**
 * Thin Higgsfield API client wired to environment variables.
 *
 * This is intentionally minimal so we can plug in concrete
 * image/video generation endpoints later without touching auth/wiring.
 *
 * Env:
 * - HIGGSFIELD_API_KEY    → key ID
 * - HIGGSFIELD_API_SECRET → key secret
 * - HIGGSFIELD_API_BASE_URL (optional, defaults to https://api.higgsfield.ai)
 *
 * IMPORTANT: Never hardcode real keys in code or commit them to git.
 */

const DEFAULT_BASE_URL = "https://api.higgsfield.ai";

export interface HiggsfieldCredentials {
  keyId: string;
  secret: string;
}

function getHiggsfieldCredentials(): HiggsfieldCredentials {
  const keyId = process.env.HIGGSFIELD_API_KEY;
  const secret = process.env.HIGGSFIELD_API_SECRET;

  if (!keyId || !secret) {
    throw new Error(
      "HIGGSFIELD_API_KEY and HIGGSFIELD_API_SECRET must be set in your environment"
    );
  }

  return { keyId, secret };
}

function getBaseUrl(): string {
  return process.env.HIGGSFIELD_API_BASE_URL || DEFAULT_BASE_URL;
}

export interface HiggsfieldRequestOptions {
  /** HTTP method, defaults to POST for generation-style calls. */
  method?: "GET" | "POST";
  /** Request body, will be JSON-stringified if provided. */
  body?: unknown;
  /** Optional AbortSignal to cancel the request. */
  signal?: AbortSignal;
}

/**
 * Generic request helper. Use this for specific endpoints like:
 *
 * - Text-to-image
 * - Image-to-video
 * - Other generation endpoints
 *
 * Example future usage (pseudo-code, adjust per docs):
 *
 *   const result = await higgsfieldRequest("/v1/images", {
 *     method: "POST",
 *     body: { prompt, model: "flux-pro", ... },
 *   });
 */
export async function higgsfieldRequest<TResponse = unknown>(
  path: string,
  options: HiggsfieldRequestOptions = {}
): Promise<TResponse> {
  const { keyId, secret } = getHiggsfieldCredentials();
  const baseUrl = getBaseUrl();

  const url = new URL(path, baseUrl);

  const res = await fetch(url.toString(), {
    method: options.method ?? "POST",
    headers: {
      "Content-Type": "application/json",
      // Higgsfield supports KEY_ID:KEY_SECRET style credentials.
      // If their docs change, update this header in one place.
      Authorization: `Key ${keyId}:${secret}`,
    },
    body: options.body !== undefined ? JSON.stringify(options.body) : undefined,
    signal: options.signal,
  });

  const text = await res.text().catch(() => "");

  if (!res.ok) {
    // Try to surface JSON error payloads while staying defensive.
    try {
      const json = text ? JSON.parse(text) : null;
      const message =
        (json && (json.error || json.message)) ||
        res.statusText ||
        "Unknown Higgsfield error";
      throw new Error(`Higgsfield error ${res.status}: ${message}`);
    } catch {
      throw new Error(
        `Higgsfield error ${res.status}: ${text || res.statusText}`
      );
    }
  }

  if (!text) {
    // Some endpoints might return empty 204 responses.
    return undefined as TResponse;
  }

  try {
    return JSON.parse(text) as TResponse;
  } catch {
    // If the endpoint returns non-JSON (e.g. plain text), just return it as-is.
    return text as unknown as TResponse;
  }
}

