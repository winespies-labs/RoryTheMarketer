import { fetchAllChannelMessages } from "@/lib/slack";
import { mergeReviews, parseSlackMessage } from "@/lib/reviews-storage";

/** Pull bot messages from Slack and merge into brand review storage. */
export async function runSlackReviewsSync(
  brandId: string,
  channelId: string
): Promise<{ added: number; total: number; messageCount: number }> {
  const messages = await fetchAllChannelMessages(channelId);
  const botMessages = messages.filter((msg) => !!msg.bot_id);
  const incoming = botMessages.map((msg) => parseSlackMessage(msg));
  const { added, total } = await mergeReviews(brandId, incoming, {
    slackChannelId: channelId,
  });
  return { added, total, messageCount: messages.length };
}
