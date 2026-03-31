/**
 * Slack API helpers for pulling review messages from a channel.
 * Requires SLACK_BOT_TOKEN (Bot User OAuth Token) with scope: channels:history and/or groups:history (if private).
 */

const SLACK_API_BASE = "https://slack.com/api";

export interface SlackAttachment {
  title?: string;
  text?: string;
  fallback?: string;
  author_name?: string;
  footer?: string;
}

export interface SlackMessage {
  type: string;
  user?: string;
  text: string;
  ts: string;
  bot_id?: string;
  subtype?: string;
  attachments?: SlackAttachment[];
}

export interface ConversationsHistoryResponse {
  ok: boolean;
  messages?: SlackMessage[];
  error?: string;
  response_metadata?: { next_cursor?: string };
}

export async function fetchChannelHistory(
  channelId: string,
  options?: { limit?: number; oldest?: string; cursor?: string }
): Promise<ConversationsHistoryResponse> {
  const token = process.env.SLACK_BOT_TOKEN;
  if (!token) {
    return { ok: false, error: "SLACK_BOT_TOKEN is not set" };
  }

  const params = new URLSearchParams({
    channel: channelId,
    limit: String(options?.limit ?? 100),
  });
  if (options?.oldest) params.set("oldest", options.oldest);
  if (options?.cursor) params.set("cursor", options.cursor);

  const res = await fetch(`${SLACK_API_BASE}/conversations.history?${params}`, {
    headers: { Authorization: `Bearer ${token}` },
  });

  const data = (await res.json()) as ConversationsHistoryResponse;
  if (!res.ok) {
    return { ok: false, error: data.error ?? `HTTP ${res.status}` };
  }
  return data;
}

/** Fetch all messages in a channel (paginates until no more). */
export async function fetchAllChannelMessages(
  channelId: string,
  maxMessages: number = 5000
): Promise<SlackMessage[]> {
  const all: SlackMessage[] = [];
  let cursor: string | undefined;
  do {
    const result = await fetchChannelHistory(channelId, {
      limit: 200,
      cursor,
    });
    if (!result.ok || !result.messages) {
      if (result.error) throw new Error(result.error);
      break;
    }
    for (const msg of result.messages) {
      if (msg.text?.trim() || msg.attachments?.length) all.push(msg);
      if (all.length >= maxMessages) return all;
    }
    cursor = result.response_metadata?.next_cursor;
  } while (cursor);
  return all;
}
