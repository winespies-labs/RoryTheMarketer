// app/api/pdp/generate-copy/route.ts
import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getContextBundle } from "@/lib/context-bundle";
import { getBrand } from "@/lib/brands";

export const maxDuration = 60;

interface WineInput {
  saleId: number;
  wineName: string;
  score?: string;
  pullQuote?: string;
  salePrice?: string;
  retailPrice?: string;
}

interface WineCopy {
  saleId: number;
  headline: string;
  primaryText: string;
  description: string;
}

const client = new Anthropic();

export async function POST(req: NextRequest) {
  const body = (await req.json()) as { brand?: string; wines: WineInput[] };
  const brand = body.brand ?? "winespies";
  if (!getBrand(brand)) {
    return NextResponse.json({ error: "Unknown brand" }, { status: 400 });
  }

  if (!Array.isArray(body.wines) || body.wines.length === 0) {
    return NextResponse.json({ error: "wines array required" }, { status: 400 });
  }

  const contextBundle = await getContextBundle(brand);

  const systemPrompt = `You are a skilled direct-response copywriter for Wine Spies, a members-only wine e-commerce brand. Write compelling, deal-driven Facebook ad copy.

Brand context:
${JSON.stringify(contextBundle, null, 2)}

Rules:
- Headline: max 125 characters, specific to this wine, highlight deal or quality
- primaryText: 2-3 sentences in Wine Spies voice — urgency, value, quality cues
- description: max 30 characters, short punchy tagline
- Return ONLY a valid JSON object: { "headline": "...", "primaryText": "...", "description": "..." }
- No markdown, no explanation, no extra text`;

  const copies: WineCopy[] = await Promise.all(
    body.wines.map(async (wine): Promise<WineCopy> => {
      const userPrompt = `Write Facebook ad copy for this wine:

Wine: ${wine.wineName}${wine.score ? `\nScore: ${wine.score}` : ""}${wine.pullQuote ? `\nDescription: ${wine.pullQuote}` : ""}${wine.salePrice ? `\nSale Price: ${wine.salePrice}` : ""}${wine.retailPrice ? `\nRetail Price: ${wine.retailPrice}` : ""}`;

      try {
        const msg = await client.messages.create({
          model: "claude-sonnet-4-5",
          max_tokens: 400,
          system: systemPrompt,
          messages: [{ role: "user", content: userPrompt }],
        });

        const text =
          msg.content[0].type === "text" ? msg.content[0].text.trim() : "";
        const parsed = JSON.parse(text) as {
          headline?: string;
          primaryText?: string;
          description?: string;
        };

        return {
          saleId: wine.saleId,
          headline: (parsed.headline ?? wine.wineName).slice(0, 125),
          primaryText:
            parsed.primaryText ??
            (wine.salePrice
              ? `${wine.wineName} — now just ${wine.salePrice}. Shop before it's gone.`
              : `${wine.wineName} — a rare find. Shop before it's gone.`),
          description: (parsed.description ?? "Shop Wine Spies →").slice(0, 30),
        };
      } catch (err) {
        console.error(
          `[generate-copy] Failed to generate copy for wine ${wine.saleId} (${wine.wineName}):`,
          err
        );
        // Fallback copy if Claude fails or returns invalid JSON
        return {
          saleId: wine.saleId,
          headline: wine.wineName.slice(0, 125),
          primaryText:
            wine.pullQuote ??
            (wine.salePrice
              ? `${wine.wineName} — now just ${wine.salePrice}. Limited time.`
              : `${wine.wineName} — limited time offer.`),
          description: "Shop Wine Spies →",
        };
      }
    }),
  );

  return NextResponse.json({ copies });
}
