import { NextRequest, NextResponse } from "next/server";
import { getBrand } from "@/lib/brands";
import { fetchAllChannelMessages } from "@/lib/slack";
import {
  mergeReviews,
  parseSlackMessage,
} from "@/lib/reviews-storage";

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
    const messages = await fetchAllChannelMessages(channelId);
    // Only keep bot messages (Trustpilot and App Store Review Bot are Slack apps)
    const botMessages = messages.filter((msg) => !!msg.bot_id);
    const incoming = botMessages.map((msg) => parseSlackMessage(msg));
    const { added, total } = mergeReviews(brandId, incoming, {
      slackChannelId: channelId,
    });

    return NextResponse.json({
      ok: true,
      added,
      total,
      messageCount: messages.length,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Sync failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
