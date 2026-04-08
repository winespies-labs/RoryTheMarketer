import { NextResponse } from "next/server";

/** Non-secret hints for the reviews UI (Slack env configured on server). */
export async function GET() {
  const ch = process.env.SLACK_REVIEWS_CHANNEL_ID?.trim();
  return NextResponse.json({
    slackChannelConfigured: Boolean(ch),
  });
}
