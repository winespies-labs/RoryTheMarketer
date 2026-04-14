import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getBrand } from "@/lib/brands";
import { getContextBundle, formatContextForPrompt } from "@/lib/context-bundle";
import {
  getContextLibraryItemsByIds,
  getStarredContextLibraryItems,
} from "@/lib/context-library-storage";

const client = new Anthropic();

export const maxDuration = 60;

type WineWriteUpInput = {
  wineName?: string;
  varietal?: string;
  region?: string;
  points?: string;
  priceDiscount?: string;
  tastingNotes?: string;
  scarcityAngle?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      brand: brandId,
      prompt,
      copyType,
      persona,
      swipeFileIds,
      wineWriteUp,
      includeWhyItWorks,
    } = body as {
      brand?: string;
      prompt?: string;
      copyType?: string;
      persona?: string;
      swipeFileIds?: string[];
      wineWriteUp?: WineWriteUpInput;
      includeWhyItWorks?: boolean;
    };

    if (!brandId || !getBrand(brandId)) {
      return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
    }

    const isWineWriteUp = copyType === "Wine write up";
    const hasWineContext = isWineWriteUp && wineWriteUp?.wineName?.trim();
    if (!prompt?.trim() && !hasWineContext) {
      return NextResponse.json(
        { error: "Missing prompt, or for Wine write up provide at least wine name" },
        { status: 400 }
      );
    }

    const bundle = await getContextBundle(brandId);
    const contextText = formatContextForPrompt(bundle);

    let swipeContext = "";
    const swipeItems = swipeFileIds?.length
      ? await getContextLibraryItemsByIds(brandId, swipeFileIds)
      : isWineWriteUp
        ? await getStarredContextLibraryItems(brandId, {
            types: ["swipe", "copywriting", "ad_copy"],
            limit: 8,
          })
        : [];

    if (swipeItems.length > 0) {
      swipeContext =
        "\n\nHere are reference copy examples to match in tone and style:\n\n" +
        swipeItems
          .map((i) => {
            const whyItWorks =
              includeWhyItWorks &&
              typeof i.meta?.whyItWorks === "string" &&
              i.meta.whyItWorks.trim()
                ? `\n\nWhy it works:\n${i.meta.whyItWorks.trim()}`
                : "";
            return `[${i.type}] ${i.title ?? ""}\n${i.content}${whyItWorks}`;
          })
          .join("\n\n---\n\n");
    }

    const systemPrompt = `You are an expert copywriter. You write in the exact brand voice provided below. Your copy is direct, compelling, and ready to use.

${contextText}
${swipeContext}

${persona ? `Write for this persona: ${persona}` : ""}
${copyType ? `Copy type: ${copyType}` : ""}

Rules:
- Match the brand voice exactly
- Be concise and punchy
- Provide multiple variations when appropriate
- Include specific details, not generic filler
${isWineWriteUp ? `\nFor Wine write up: Produce the complete daily wine sales copy — the full email/landing page write-up that sells the wine. Lead with the deal (points + discount). Use proof and scarcity where provided. Keep the brand voice; no generic wine-review filler.${bundle.wineCopyGuidance ? "\n\nFollow this wine copy guidance closely — it contains specific style rules and examples:\n" + bundle.wineCopyGuidance : ""}` : ""}`;

    let userContent: string;
    if (isWineWriteUp && wineWriteUp?.wineName?.trim()) {
      const lines: string[] = ["Write the full sales copy for this daily wine offer.\n"];
      lines.push(`**Wine:** ${wineWriteUp.wineName.trim()}`);
      if (wineWriteUp.varietal?.trim()) lines.push(`**Varietal:** ${wineWriteUp.varietal.trim()}`);
      if (wineWriteUp.region?.trim()) lines.push(`**Region/AVA:** ${wineWriteUp.region.trim()}`);
      if (wineWriteUp.points?.trim()) lines.push(`**Points/rating:** ${wineWriteUp.points.trim()}`);
      if (wineWriteUp.priceDiscount?.trim()) lines.push(`**Price/discount:** ${wineWriteUp.priceDiscount.trim()}`);
      if (wineWriteUp.tastingNotes?.trim()) lines.push(`**Tasting notes:** ${wineWriteUp.tastingNotes.trim()}`);
      if (wineWriteUp.scarcityAngle?.trim()) lines.push(`**Scarcity/angle:** ${wineWriteUp.scarcityAngle.trim()}`);
      if (prompt?.trim()) lines.push(`\n**Additional instructions:**\n${prompt.trim()}`);
      userContent = lines.join("\n");
    } else {
      userContent = prompt!.trim();
    }

    const msg = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userContent }],
    });

    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    return NextResponse.json({ copy: text });
  } catch (err) {
    console.error("[copywriter] Error:", err);
    const message = err instanceof Error ? err.message : "Internal server error";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
