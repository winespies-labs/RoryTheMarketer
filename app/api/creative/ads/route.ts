import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getBrand } from "@/lib/brands";

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  const brandId = req.nextUrl.searchParams.get("brand") ?? "winespies";
  const saleId = req.nextUrl.searchParams.get("saleId");

  try { getBrand(brandId); } catch {
    return NextResponse.json({ error: "Unknown brand" }, { status: 400 });
  }

  const ads = await prisma.pdpGeneratedAd.findMany({
    where: {
      brandId,
      ...(saleId ? { saleId: parseInt(saleId, 10) } : {}),
    },
    orderBy: { createdAt: "desc" },
    take: 100,
  });

  return NextResponse.json(ads);
}

export async function POST(req: NextRequest) {
  let body: Record<string, unknown>;
  try { body = await req.json(); } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const brandId = (body.brandId as string | undefined) ?? "winespies";
  try { getBrand(brandId); } catch {
    return NextResponse.json({ error: "Unknown brand" }, { status: 400 });
  }

  const { saleId, templateId, wineName, templateName, headline, primaryText, description, imageUrl, saleUrl } = body as {
    saleId?: number;
    templateId?: string;
    wineName?: string;
    templateName?: string;
    headline?: string;
    primaryText?: string;
    description?: string;
    imageUrl?: string;
    saleUrl?: string;
  };

  if (!saleId || !templateId || !wineName || !headline || !primaryText || !saleUrl) {
    return NextResponse.json({ error: "Missing required fields" }, { status: 400 });
  }

  const ad = await prisma.pdpGeneratedAd.create({
    data: {
      brandId,
      saleId,
      templateId,
      wineName: wineName ?? "",
      templateName: templateName ?? templateId,
      headline,
      primaryText,
      description: description ?? "",
      imageUrl: imageUrl ?? null,
      saleUrl,
      status: "saved",
    },
  });

  return NextResponse.json(ad);
}
