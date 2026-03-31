import { NextRequest } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

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
    const { messages, adContext } = body as {
      brand?: string;
      messages?: { role: "user" | "assistant"; content: string }[];
      adContext?: {
        headline?: string;
        primaryText?: string;
        description?: string;
        ctaType?: string;
        destinationUrl?: string;
      };
    };

    if (!process.env.ANTHROPIC_API_KEY?.trim()) {
      return jsonResponse({ error: "ANTHROPIC_API_KEY is not set" }, 503);
    }
    if (!messages?.length) {
      return jsonResponse({ error: "Missing messages" }, 400);
    }

    // Build system prompt with ad context
    let systemPrompt = `You are an expert ad copywriter and creative strategist. You help write compelling Facebook/Instagram ad copy — headlines, primary text, descriptions, and CTAs.

Be concise, punchy, and specific. Give multiple variations when asked. Focus on hooks, benefits, and urgency. Avoid generic marketing speak.`;

    if (adContext) {
      const parts: string[] = [];
      if (adContext.headline) parts.push(`Headline: ${adContext.headline}`);
      if (adContext.primaryText) parts.push(`Primary text: ${adContext.primaryText}`);
      if (adContext.description) parts.push(`Description: ${adContext.description}`);
      if (adContext.ctaType) parts.push(`CTA: ${adContext.ctaType}`);
      if (adContext.destinationUrl) parts.push(`URL: ${adContext.destinationUrl}`);
      if (parts.length > 0) {
        systemPrompt += `\n\n--- Current ad elements ---\n${parts.join("\n")}`;
      }
    }

    let stream;
    try {
      stream = client.messages.stream({
        model: "claude-sonnet-4-5",
        max_tokens: 2048,
        system: systemPrompt,
        messages: messages.map((m) => ({ role: m.role, content: m.content })),
      });
    } catch (err) {
      const message = err instanceof Error ? err.message : String(err);
      return jsonResponse({ error: "Anthropic API error", details: message }, 502);
    }

    const readable = new ReadableStream({
      async start(controller) {
        try {
          for await (const event of stream) {
            if (
              event.type === "content_block_delta" &&
              event.delta.type === "text_delta"
            ) {
              controller.enqueue(new TextEncoder().encode(event.delta.text));
            }
          }
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
    return jsonResponse({ error: "Chat request failed", details: message }, 502);
  }
}
