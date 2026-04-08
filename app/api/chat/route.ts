import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getBrand } from "@/lib/brands";
import { getContextBundle, formatContextForPrompt } from "@/lib/context-bundle";
import { formatReviewSnippetsForPrompt } from "@/lib/reviews-storage";
import { appendMessage, updateChatTitle, getChat } from "@/lib/chat-storage";

const client = new Anthropic();

export const maxDuration = 60;

function jsonResponse(body: { error: string; details?: string }, status: number) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { brand: brandId, chatId, messages } = body as {
      brand?: string;
      chatId?: string;
      messages?: { role: "user" | "assistant"; content: string }[];
    };

    if (!process.env.ANTHROPIC_API_KEY?.trim()) {
      return jsonResponse(
        {
          error: "ANTHROPIC_API_KEY is not set. Add it in Railway (or .env) and redeploy.",
        },
        503
      );
    }
    if (!brandId || !getBrand(brandId)) {
      return jsonResponse({ error: "Invalid brand" }, 400);
    }
    if (!chatId || !messages?.length) {
      return jsonResponse({ error: "Missing chatId or messages" }, 400);
    }

    const lastMessage = messages[messages.length - 1];
    if (lastMessage.role !== "user") {
      return jsonResponse({ error: "Last message must be from user" }, 400);
    }

    // Persist user message
    appendMessage(brandId, chatId, "user", lastMessage.content);

    // Auto-title from first user message
    const chat = getChat(brandId, chatId);
    if (chat && chat.messages.length === 1) {
      const title = lastMessage.content.slice(0, 50) + (lastMessage.content.length > 50 ? "..." : "");
      updateChatTitle(brandId, chatId, title);
    }

    // Build system prompt
    const bundle = getContextBundle(brandId);
    const contextText = formatContextForPrompt(bundle);
    const reviewSnippets = await formatReviewSnippetsForPrompt(brandId, {
      limit: 18,
      maxCharsPerReview: 280,
    });
    const systemPrompt = `You are Rory, a senior marketing strategist and expert copywriter. You help marketers create compelling campaigns, write copy, develop strategy, and solve marketing problems.

You are direct, knowledgeable, and opinionated. You give specific, actionable advice — not generic marketing platitudes. When you don't know something, you say so.

Use the brand context below to give grounded, specific advice. Reference the brand voice, personas, USPs, and customer review themes or sample reviews when relevant.

---

${contextText}${reviewSnippets}`;

    // Use current model alias (claude-sonnet-4-5-20250514 is deprecated)
    let stream;
    try {
      stream = client.messages.stream({
        model: "claude-sonnet-4-5",
        max_tokens: 4096,
        system: systemPrompt,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return jsonResponse(
        { error: "Anthropic API error", details: message },
        502
      );
    }

    let fullResponse = "";

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              const text = event.delta.text;
              fullResponse += text;
              controller.enqueue(new TextEncoder().encode(text));
            }
          }
          appendMessage(brandId, chatId, "assistant", fullResponse);
          controller.close();
        } catch (err) {
          const message = err instanceof Error ? err.message : String(err);
          controller.error(new Error(message));
        }
      },
    });

    return new Response(readable, {
      headers: {
        "Content-Type": "text/plain; charset=utf-8",
        "Transfer-Encoding": "chunked",
      },
    });
  } catch (err) {
    const message = err instanceof Error ? err.message : String(err);
    return jsonResponse(
      { error: "Chat request failed", details: message },
      502
    );
  }
}
