import { NextRequest, NextResponse } from "next/server";
import {
  isAuthEnabled,
  createSessionToken,
  AUTH_COOKIE_NAME,
  SESSION_DURATION_MS,
} from "@/lib/auth";

export async function POST(request: NextRequest) {
  if (!isAuthEnabled()) {
    return NextResponse.json({ error: "Auth not configured" }, { status: 400 });
  }

  const body = await request.json();
  const { username, password } = body;

  if (
    username !== process.env.AUTH_USERNAME ||
    password !== process.env.AUTH_PASSWORD
  ) {
    return NextResponse.json(
      { error: "Invalid username or password" },
      { status: 401 }
    );
  }

  const token = createSessionToken(username);
  const response = NextResponse.json({ success: true });

  response.cookies.set(AUTH_COOKIE_NAME, token, {
    httpOnly: true,
    secure: process.env.NODE_ENV === "production",
    sameSite: "lax",
    path: "/",
    maxAge: Math.floor(SESSION_DURATION_MS / 1000),
  });

  return response;
}
