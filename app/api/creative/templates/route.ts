import { NextRequest, NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";
import { getBrand } from "@/lib/brands";
import { nanoid } from "nanoid";

const prisma = new PrismaClient();

export async function GET(req: NextRequest) {
  const brandId = req.nextUrl.searchParams.get("brand") ?? "winespies";
  try { getBrand(brandId); } catch {
    return NextResponse.json({ error: "Unknown brand" }, { status: 400 });
  }

  const templates = await prisma.pdpTemplate.findMany({
    where: { brandId },
    orderBy: { createdAt: "asc" },
  });

  return NextResponse.json(templates);
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

  const { name, type, fields, thumbnail, id } = body as {
    name?: string;
    type?: string;
    fields?: unknown;
    thumbnail?: string;
    id?: string;
  };

  if (!name || !type || !fields) {
    return NextResponse.json({ error: "name, type, fields required" }, { status: 400 });
  }

  const templateId = (id as string | undefined)?.trim() || nanoid(10);

  const template = await prisma.pdpTemplate.upsert({
    where: { id: templateId },
    create: {
      id: templateId,
      brandId,
      name,
      type,
      fields: fields as object,
      thumbnail: thumbnail ?? null,
      updatedAt: new Date(),
    },
    update: {
      name,
      type,
      fields: fields as object,
      thumbnail: thumbnail ?? null,
      updatedAt: new Date(),
    },
  });

  return NextResponse.json(template);
}
