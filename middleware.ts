import { NextRequest, NextResponse } from "next/server";

const AUTH_COOKIE_NAME = "rory_session";

/**
 * Validates the session token using Web Crypto API (Edge-compatible).
 */
async function validateToken(token: string, secret: string): Promise<boolean> {
  const parts = token.split(":");
  if (parts.length !== 3) return false;

  const [username, expiryStr, signature] = parts;
  const expiry = parseInt(expiryStr, 10);

  if (!username || isNaN(expiry)) return false;
  if (Date.now() > expiry) return false;

  const encoder = new TextEncoder();
  const key = await crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"]
  );

  const data = encoder.encode(`${username}:${expiryStr}`);
  const sig = await crypto.subtle.sign("HMAC", key, data);
  const expectedHex = Array.from(new Uint8Array(sig))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");

  // Constant-time comparison
  if (signature.length !== expectedHex.length) return false;
  let mismatch = 0;
  for (let i = 0; i < signature.length; i++) {
    mismatch |= signature.charCodeAt(i) ^ expectedHex.charCodeAt(i);
  }
  return mismatch === 0;
}

export async function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl;

  // Auth disabled if env vars not set — pass through everything
  const authUsername = process.env.AUTH_USERNAME;
  const authPassword = process.env.AUTH_PASSWORD;
  const authSecret = process.env.AUTH_SECRET;

  if (!authUsername || !authPassword || !authSecret) {
    return NextResponse.next();
  }

  // Skip auth for these paths
  if (
    pathname === "/login" ||
    pathname.startsWith("/api/auth/") ||
    pathname.startsWith("/api/cron/")
  ) {
    return NextResponse.next();
  }

  // Check session cookie
  const token = request.cookies.get(AUTH_COOKIE_NAME)?.value;

  if (token && (await validateToken(token, authSecret))) {
    return NextResponse.next();
  }

  // Unauthenticated API requests get 401
  if (pathname.startsWith("/api/")) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // Unauthenticated page requests redirect to login
  const loginUrl = new URL("/login", request.url);
  return NextResponse.redirect(loginUrl);
}

export const config = {
  matcher: [
    /*
     * Match all paths except:
     * - _next/static (static files)
     * - _next/image (image optimization)
     * - favicon.ico, sitemap.xml, robots.txt
     * - public file extensions (svg, png, jpg, etc.)
     */
    "/((?!_next/static|_next/image|favicon.ico|sitemap.xml|robots.txt|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
