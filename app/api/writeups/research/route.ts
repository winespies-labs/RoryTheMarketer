import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";

const anthropic = new Anthropic();

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { wineName } = body;

    if (!wineName?.trim()) {
      return NextResponse.json(
        { error: "wineName is required" },
        { status: 400 }
      );
    }

    const response = await anthropic.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      system: `You are a wine research assistant for Wine Spies, an email-first wine deals site. Your job is to gather and organize background information on a wine that a copywriter will use to write a deal email.

Be thorough and factual. Include specific details the copywriter can use — names, numbers, anecdotes, quotes. If you don't know something for certain, say so. Don't fabricate reviews or scores.

Output format — use these exact section headers:

## Producer
Who makes this wine? History, founding story, location, anything surprising or non-wine about the people behind it. The copywriter needs one great "non-wine surprise" for the producer story.

## Winemaker
Who is the winemaker? Career arc, notable previous positions, philosophy, any 100-point wines or famous projects.

## The Wine
Varietal(s), region, AVA, vineyard details, production methods, case production if known. What makes this specific wine notable?

## Scores & Reviews
Any known critic scores (Wine Advocate, Wine Spectator, Wine Enthusiast, Jeb Dunnuck, Vinous, etc.). Include the publication, score, and any notable quote fragments.

## Tasting Notes
Flavor profile, texture, finish. Use concrete sensory language — the copywriter will adapt this into the brand voice.

## Talking Points
3-5 bullet points a copywriter could use as hooks: price anchoring angles, credential drops, scarcity signals, seasonal ties, food pairings, or unexpected facts.`,
      messages: [
        {
          role: "user",
          content: `Research this wine for a Wine Spies write-up: ${wineName.trim()}\n\nProvide as much specific, factual detail as you can. The copywriter needs real names, real scores, real production details.`,
        },
      ],
    });

    const text =
      response.content[0].type === "text" ? response.content[0].text : "";

    return NextResponse.json({ research: text });
  } catch (err: unknown) {
    console.error("Wine research API error:", err);
    const message = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
