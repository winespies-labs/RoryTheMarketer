import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

const SYSTEM_PROMPT = `You are a copy analyst specializing in direct-response and wine deal email marketing. You analyze a single piece of copy (a "swipe") and explain exactly why it's effective.

Return your analysis as JSON with these fields:
- technique: string — the primary copywriting technique (e.g. "Price Anchoring", "Urgency & Scarcity", "Sensory Copy", "Credential Drop", "Lead Hook", "Storytelling", "Subject Line Craft")
- whyItWorks: string — 2-4 sentences explaining the specific craft moves. What structural, tonal, or psychological technique is at play? Be specific about the copywriting mechanics.
- mechanism: string — A short one-line formula showing the structural pattern (e.g. "Rhetorical question + price recap → emotional release → superlative label")
- drillPrompt: string — A prompt telling a copywriter how to replicate this technique for their own product. Include the structural pattern and constraints (sentence count, what to include/exclude).

Return ONLY valid JSON, no markdown fences.`;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { content } = body;

    if (!content?.trim()) {
      return NextResponse.json(
        { error: "content is required" },
        { status: 400 }
      );
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: "user",
          content: `Analyze this swipe:\n\n"${content.trim()}"`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    try {
      const analysis = JSON.parse(text);
      return NextResponse.json({ ok: true, analysis });
    } catch {
      return NextResponse.json(
        { error: "Failed to parse analysis response", raw: text },
        { status: 500 }
      );
    }
  } catch (err: unknown) {
    console.error("Swipe analyze-single error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
