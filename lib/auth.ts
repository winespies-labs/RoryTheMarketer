import { createHmac } from "crypto";

export const AUTH_COOKIE_NAME = "rory_session";
export const SESSION_DURATION_MS = 7 * 24 * 60 * 60 * 1000; // 7 days

/**
 * Returns true if auth environment variables are configured.
 * When unconfigured, auth is disabled (open access for local dev).
 */
export function isAuthEnabled(): boolean {
  return !!(
    process.env.AUTH_USERNAME &&
    process.env.AUTH_PASSWORD &&
    process.env.AUTH_SECRET
  );
}

/**
 * Creates an HMAC-signed session token: "username:expiry:signature"
 */
export function createSessionToken(username: string): string {
  const secret = process.env.AUTH_SECRET!;
  const expiry = Date.now() + SESSION_DURATION_MS;
  const payload = `${username}:${expiry}`;
  const signature = createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  return `${payload}:${signature}`;
}

/**
 * Validates a session token. Returns true if signature is valid and not expired.
 */
export function validateSessionToken(token: string): boolean {
  const secret = process.env.AUTH_SECRET;
  if (!secret) return false;

  const parts = token.split(":");
  if (parts.length !== 3) return false;

  const [username, expiryStr, signature] = parts;
  const expiry = parseInt(expiryStr, 10);

  if (!username || isNaN(expiry)) return false;
  if (Date.now() > expiry) return false;

  const expectedSignature = createHmac("sha256", secret)
    .update(`${username}:${expiryStr}`)
    .digest("hex");

  // Constant-time comparison
  if (signature.length !== expectedSignature.length) return false;
  let mismatch = 0;
  for (let i = 0; i < signature.length; i++) {
    mismatch |= signature.charCodeAt(i) ^ expectedSignature.charCodeAt(i);
  }
  return mismatch === 0;
}
