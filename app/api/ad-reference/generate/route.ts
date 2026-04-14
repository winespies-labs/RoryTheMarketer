import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getBrand } from "@/lib/brands";
import { getContextBundle, formatContextForPrompt } from "@/lib/context-bundle";
import { getReferenceAdById } from "@/lib/reference-ads";
import { buildMetaStaticNanoBananaPrompt } from "@/lib/ad-prompt-templates";

const client = new Anthropic();

export const maxDuration = 60;

/** Extract JSON array from model output; strip markdown code blocks if present. */
function extractJsonArray(text: string): unknown {
  let raw = text.trim();
  const codeBlock = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  if (codeBlock) raw = codeBlock[1].trim();
  const arrayStart = raw.indexOf("[");
  if (arrayStart !== -1) {
    const arrayEnd = raw.lastIndexOf("]");
    if (arrayEnd > arrayStart) raw = raw.slice(arrayStart, arrayEnd + 1);
  }
  return JSON.parse(raw);
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid JSON body" },
      { status: 400 },
    );
  }

  const brandId = (body.brand as string | undefined) ?? undefined;
  const referenceId = (body.referenceId as string | undefined) ?? undefined;
  const referenceIds = (body.referenceIds as string[] | undefined) ?? undefined;
  const wineDetails = (body.wineDetails as
    | {
        headline?: string;
        score?: string;
        pullQuote?: string;
        retailPrice?: string;
        salePrice?: string;
        promoCode?: string;
        ctaText?: string;
        additionalNotes?: string;
      }
    | undefined) ?? undefined;
  const wineName = typeof body.wineName === "string" ? body.wineName : undefined;
  const saleId =
    typeof body.saleId === "number" && Number.isFinite(body.saleId)
      ? body.saleId
      : typeof body.saleId === "string" && /^\d+$/.test(body.saleId)
        ? parseInt(body.saleId, 10)
        : undefined;

  if (!brandId || !getBrand(brandId)) {
    return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
  }

  // Support both single referenceId and array referenceIds
  const ids = referenceIds ?? (referenceId ? [referenceId] : []);

  if (ids.length === 0) {
    return NextResponse.json(
      { error: "referenceId or referenceIds is required" },
      { status: 400 },
    );
  }

  try {
    const bundle = await getContextBundle(brandId);
    const contextText = formatContextForPrompt(bundle);

    // If multiple IDs, generate for each and return grouped
    if (ids.length > 1) {
      const byReferenceId: Record<string, unknown[]> = {};

      for (const id of ids) {
        const refAd = getReferenceAdById(id);
        if (!refAd) continue;
        if (refAd.meta.brand && refAd.meta.brand !== brandId) continue;

        const { system, user, numberOfVariations } = buildMetaStaticNanoBananaPrompt({
          brandName: brandId,
          contextText,
          referenceAd: refAd,
          wineDetailsOverride: wineDetails,
          wineName,
          saleId,
        });

        const msg = await client.messages.create({
          model: "claude-sonnet-4-5",
          max_tokens: 2000,
          system,
          messages: [{ role: "user", content: user }],
        });

        const text = msg.content
          .filter((b): b is Anthropic.TextBlock => b.type === "text")
          .map((b) => b.text)
          .join("")
          .trim();

        try {
          const parsed = extractJsonArray(text);
          byReferenceId[id] = Array.isArray(parsed) ? parsed as unknown[] : [];
        } catch {
          byReferenceId[id] = [];
        }
      }

      return NextResponse.json({ brand: brandId, byReferenceId });
    }

    // Single reference ID (original behavior)
    const singleId = ids[0];
    const referenceAd = getReferenceAdById(singleId);
    if (!referenceAd) {
      return NextResponse.json(
        { error: `Reference ad not found for id ${singleId}` },
        { status: 404 },
      );
    }

    if (referenceAd.meta.brand && referenceAd.meta.brand !== brandId) {
      return NextResponse.json(
        {
          error: `Reference ad ${singleId} is configured for brand ${referenceAd.meta.brand}, not ${brandId}`,
        },
        { status: 400 },
      );
    }

    const { system, user, numberOfVariations } = buildMetaStaticNanoBananaPrompt({
      brandName: brandId,
      contextText,
      referenceAd,
      wineDetailsOverride: wineDetails,
      wineName,
      saleId,
    });

    const msg = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 2000,
      system,
      messages: [{ role: "user", content: user }],
    });

    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("")
      .trim();

    let parsed: unknown;
    try {
      parsed = extractJsonArray(text);
    } catch {
      return NextResponse.json(
        {
          error: "Model response was not valid JSON",
          raw: text.slice(0, 500),
        },
        { status: 502 },
      );
    }

    if (!Array.isArray(parsed)) {
      return NextResponse.json(
        {
          error: "Expected an array of variations from model",
          raw: parsed,
        },
        { status: 502 },
      );
    }

    return NextResponse.json({
      referenceId: singleId,
      brand: brandId,
      expectedVariations: numberOfVariations,
      variations: parsed,
    });
  } catch (err) {
    const message =
      err instanceof Error ? err.message : "Ad copy generation failed";
    return NextResponse.json(
      { error: message },
      { status: 500 },
    );
  }
}

