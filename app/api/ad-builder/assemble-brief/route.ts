import { NextRequest, NextResponse } from "next/server";
import { wineApiToTemplateProduct, type WineSale } from "@/lib/template-product";
import { getTemplate } from "@/lib/template-registry";
import { assembleBrief } from "@/lib/assembler";
import { fetchCurrentWines } from "@/lib/wine-feed";
import type { FilledBrief } from "@/lib/assembler";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const { brand, templateId, wines } = body as {
      brand: string;
      templateId: string;
      wines: { saleId: number; overrides?: Record<string, unknown> }[];
    };

    if (!templateId) {
      return NextResponse.json(
        { error: "templateId is required" },
        { status: 400 },
      );
    }

    if (!wines?.length) {
      return NextResponse.json(
        { error: "At least one wine is required" },
        { status: 400 },
      );
    }

    // Load template schema
    const template = getTemplate(templateId);
    if (!template) {
      return NextResponse.json(
        { error: `Template "${templateId}" not found` },
        { status: 404 },
      );
    }

    // Fetch current wines directly (avoids self-referencing fetch that fails on Railway)
    const allWines = await fetchCurrentWines() as WineSale[];

    const briefs: FilledBrief[] = [];

    for (const { saleId, overrides } of wines) {
      const sale = allWines.find((w) => w.id === saleId);
      if (!sale) {
        return NextResponse.json(
          { error: `Wine sale ${saleId} not found` },
          { status: 404 },
        );
      }

      const product = wineApiToTemplateProduct(sale, overrides);
      const brief = assembleBrief(product, template.schema);
      briefs.push(brief);
    }

    return NextResponse.json({ briefs });
  } catch (err) {
    const msg = err instanceof Error ? err.message : "Unknown error";
    return NextResponse.json({ error: msg }, { status: 500 });
  }
}
