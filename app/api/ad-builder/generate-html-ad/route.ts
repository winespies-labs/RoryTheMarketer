import { NextRequest, NextResponse } from "next/server";
import { getTemplate } from "@/lib/template-registry";
import { fillTemplate } from "@/lib/assembler/fill-template";
import { screenshotHtml } from "@/lib/assembler/screenshot";
import type { FilledBrief } from "@/lib/assembler";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { templateId, brief, backgroundImageBase64 } = body as {
      templateId: string;
      brief: FilledBrief;
      backgroundImageBase64?: string;
    };

    if (!templateId || !brief) {
      return NextResponse.json(
        { error: "templateId and brief are required" },
        { status: 400 },
      );
    }

    // Load template HTML
    const template = getTemplate(templateId);
    if (!template) {
      return NextResponse.json(
        { error: `Template "${templateId}" not found` },
        { status: 404 },
      );
    }

    // Build slot values for template fill
    const slotValues: Record<string, string | boolean | number> = {};

    // Slots from brief
    for (const slot of brief.slots) {
      slotValues[slot.key] = slot.value;
    }

    // Structured values
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
      // Compute promo savings (FIRST50 = $50)
      const promoMatch = brief.promoCode.match(/(\d+)/);
      slotValues.promo_savings = promoMatch ? promoMatch[1] : "50";
    }

    // Background image
    if (backgroundImageBase64) {
      slotValues.background_image = `data:image/png;base64,${backgroundImageBase64}`;
    } else if (brief.backgroundImageUrl) {
      slotValues.background_image = brief.backgroundImageUrl;
    }

    // Fill the HTML template
    const filledHtml = fillTemplate(template.html, slotValues);

    // Screenshot with Puppeteer
    const { width, height } = template.schema.layout;
    const { buffer, mimeType } = await screenshotHtml({
      html: filledHtml,
      width,
      height,
    });

    const imageBase64 = buffer.toString("base64");
    return NextResponse.json({ imageBase64, mimeType });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    console.error("[generate-html-ad]", msg);
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
