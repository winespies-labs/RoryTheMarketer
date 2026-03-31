import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getBrand } from "@/lib/brands";
import { getContextBundle, formatContextForPrompt } from "@/lib/context-bundle";
import { getContextLibraryItemsByIds, readContextLibrary } from "@/lib/context-library-storage";

const client = new Anthropic();

export const maxDuration = 60;

async function buildSwipeCopyContext(
  brandId: string,
  swipeFileIds?: string[],
  includeWhyItWorks?: boolean
): Promise<string> {
  if (swipeFileIds?.length) {
    const items = await getContextLibraryItemsByIds(brandId, swipeFileIds);
    if (items.length === 0) return "";
    return items
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
  const lib = await readContextLibrary(brandId);
  const recent = lib.items.slice(-5);
  if (recent.length === 0) return "";
  return recent
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

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { brand: brandId, persona, briefType, objective, notes, swipeFileIds, includeWhyItWorks } =
    body as {
    brand?: string;
    persona?: string;
    briefType?: string;
    objective?: string;
    notes?: string;
    swipeFileIds?: string[];
    includeWhyItWorks?: boolean;
  };

  if (!brandId || !getBrand(brandId)) {
    return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
  }

  const bundle = getContextBundle(brandId);
  const contextText = formatContextForPrompt(bundle);
  const swipeCopy = await buildSwipeCopyContext(brandId, swipeFileIds, includeWhyItWorks);

  const systemPrompt = `You are an expert marketing strategist and creative brief writer. You write briefs that are clear, actionable, and grounded in brand context.

Here is the brand context you must follow:

${contextText}

${swipeCopy ? `Here are reference copy examples (swipe files) to inform tone and style:\n\n${swipeCopy}` : ""}

Write briefs in a structured format with clear sections. Be specific and actionable. Match the brand voice exactly.`;

  const userPrompt = [
    briefType ? `Brief type: ${briefType}` : "Write a creative brief",
    persona ? `Target persona: ${persona}` : "",
    objective ? `Objective: ${objective}` : "",
    notes ? `Additional notes: ${notes}` : "",
  ].filter(Boolean).join("\n");

  try {
    const msg = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      system: systemPrompt,
      messages: [{ role: "user", content: userPrompt }],
    });

    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    return NextResponse.json({ brief: text });
  } catch (err) {
    console.error("Brief generation failed:", err);
    const message = err instanceof Error ? err.message : "Failed to generate brief";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
