import { NextRequest, NextResponse } from "next/server";
import { getTemplate } from "@/lib/template-registry";
import { fillTemplate } from "@/lib/assembler/fill-template";
import type { FilledBrief } from "@/lib/assembler";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { templateId, brief } = body as {
      templateId: string;
      brief: FilledBrief;
    };

    if (!templateId || !brief) {
      return NextResponse.json(
        { error: "templateId and brief are required" },
        { status: 400 },
      );
    }

    const template = getTemplate(templateId);
    if (!template) {
      return NextResponse.json(
        { error: `Template "${templateId}" not found` },
        { status: 404 },
      );
    }

    // Build slot values — same logic as generate-html-ad
    const slotValues: Record<string, string | boolean | number> = {};

    for (const slot of brief.slots) {
      slotValues[slot.key] = slot.value;
    }

    slotValues.logo = brief.showLogo;
    slotValues.trustpilot = brief.showTrustpilot;
    slotValues.cta_text = brief.ctaText;

    if (brief.scoreBadge) {
      slotValues.score_badge = true;
      slotValues.score = brief.scoreBadge.score;
      slotValues.score_source = brief.scoreBadge.source;
    }

    if (brief.pricePill) {
      slotValues.price_pill = true;
      slotValues.price_retail = brief.pricePill.retail;
      slotValues.price_sale = brief.pricePill.sale;
      slotValues.price_savings = brief.pricePill.savings;
    }

    if (brief.promoCode) {
      slotValues.promo_code = brief.promoCode;
      const promoMatch = brief.promoCode.match(/(\d+)/);
      slotValues.promo_savings = promoMatch ? promoMatch[1] : "50";
    }

    if (brief.backgroundImageUrl) {
      slotValues.background_image = brief.backgroundImageUrl;
    }

    const filledHtml = fillTemplate(template.html, slotValues);
    const { width, height } = template.schema.layout;

    return NextResponse.json({ html: filledHtml, width, height });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[preview-html]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
