import { NextRequest, NextResponse } from "next/server";
import { getBrand } from "@/lib/brands";
import { runSlackReviewsSync } from "@/lib/reviews-slack-sync";

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const brandId = (body.brand as string) || req.nextUrl.searchParams.get("brand");
  const channelId =
    (body.channelId as string) ||
    (body.channel as string) ||
    process.env.SLACK_REVIEWS_CHANNEL_ID;

  if (!brandId) {
    return NextResponse.json({ error: "Missing brand" }, { status: 400 });
  }
  if (!getBrand(brandId)) {
    return NextResponse.json({ error: "Unknown brand" }, { status: 400 });
  }
  if (!channelId) {
    return NextResponse.json(
      {
        error:
          "Missing channel. Set SLACK_REVIEWS_CHANNEL_ID or pass channelId in the request body.",
      },
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
      added,
      total,
      messageCount,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sync failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
