import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic();

export const maxDuration = 60;

function extractJson(text: string): {
  headline: string;
  primary_text: string;
  description: string;
} {
  let raw = text.trim();
  // Strip markdown fences
  const fence = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (fence) raw = fence[1].trim();
  // Find the JSON object
  const start = raw.indexOf("{");
  const end = raw.lastIndexOf("}");
  if (start !== -1 && end > start) raw = raw.slice(start, end + 1);

  const parsed = JSON.parse(raw);
  return {
    headline: String(parsed.headline ?? ""),
    primary_text: String(parsed.primary_text ?? ""),
    description: String(parsed.description ?? ""),
  };
}

export async function POST(req: NextRequest) {
  let body: { prompt?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const prompt = body.prompt?.trim();
  if (!prompt) {
    return NextResponse.json({ error: "prompt is required" }, { status: 400 });
  }

  const message = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 400,
    messages: [{ role: "user", content: prompt }],
  });

  const text =
    message.content
      .filter((b) => b.type === "text")
      .map((b) => (b as { type: "text"; text: string }).text)
      .join("") ?? "";

  try {
    const copy = extractJson(text);
    return NextResponse.json(copy);
  } catch {
    return NextResponse.json(
      { error: "Failed to parse model response", raw: text },
      { status: 422 }
    );
  }
}
