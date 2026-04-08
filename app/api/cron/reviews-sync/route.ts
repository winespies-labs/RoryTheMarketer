import { NextRequest, NextResponse } from "next/server";
import { BRANDS, getBrand } from "@/lib/brands";
import { runSlackReviewsSync } from "@/lib/reviews-slack-sync";

/** Slack pagination can be slow for large channels. */
export const maxDuration = 120;

function authorizeCron(req: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  return req.headers.get("authorization") === `Bearer ${secret}`;
}

/**
 * Daily Slack → reviews JSON sync (scheduled HTTP GET).
 * Call with `Authorization: Bearer <CRON_SECRET>` (e.g. Railway cron service or external cron).
 * Query: `brand` (default first configured brand). Uses SLACK_REVIEWS_CHANNEL_ID on the server.
 */
export async function GET(req: NextRequest) {
  if (!process.env.CRON_SECRET) {
    return NextResponse.json(
      { ok: false, error: "CRON_SECRET is not configured" },
      { status: 503 }
    );
  }
  if (!authorizeCron(req)) {
    return NextResponse.json({ ok: false, error: "Unauthorized" }, { status: 401 });
  }

  const brandParam = req.nextUrl.searchParams.get("brand");
  const brandId = brandParam || BRANDS[0]?.id;
  const channelId = process.env.SLACK_REVIEWS_CHANNEL_ID;

  if (!brandId) {
    return NextResponse.json({ ok: false, error: "No brand configured" }, { status: 400 });
  }
  if (!getBrand(brandId)) {
    return NextResponse.json({ ok: false, error: "Unknown brand" }, { status: 400 });
  }
  if (!channelId) {
    return NextResponse.json(
      { ok: false, error: "SLACK_REVIEWS_CHANNEL_ID is not set" },
      { status: 400 }
    );
  }

  try {
    const { added, total, messageCount } = await runSlackReviewsSync(
      brandId,
      channelId
    );
    return NextResponse.json({
      ok: true,
      brand: brandId,
      added,
      total,
      messageCount,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sync failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
