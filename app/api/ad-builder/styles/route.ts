import { NextRequest, NextResponse } from "next/server";
import { getBrand } from "@/lib/brands";
import {
  readStyles,
  addStyle,
  deleteStyle,
  saveUploadedFile,
} from "@/lib/ad-builder-storage";
import { STYLES_SUBDIR } from "@/lib/ad-builder";

export async function GET(req: NextRequest) {
  const brandId = req.nextUrl.searchParams.get("brand");
  if (!brandId || !getBrand(brandId)) {
    return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
  }

  const data = readStyles(brandId);
  return NextResponse.json({ styles: data.styles });
}

export async function POST(req: NextRequest) {
  const formData = await req.formData();
  const brandId = formData.get("brand") as string;
  const name = formData.get("name") as string;
  const image = formData.get("image") as File | null;

  if (!brandId || !getBrand(brandId)) {
    return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
  }
  if (!name || !image) {
    return NextResponse.json(
      { error: "Name and image are required" },
      { status: 400 }
    );
  }

  const buffer = Buffer.from(await image.arrayBuffer());
  const filename = saveUploadedFile(brandId, STYLES_SUBDIR, buffer, image.name);
  const style = addStyle(brandId, name, filename);

  return NextResponse.json({ style });
}

export async function DELETE(req: NextRequest) {
  const brandId = req.nextUrl.searchParams.get("brand");
  const id = req.nextUrl.searchParams.get("id");

  if (!brandId || !id || !getBrand(brandId)) {
    return NextResponse.json(
      { error: "Missing brand or id" },
      { status: 400 }
    );
  }

  const ok = deleteStyle(brandId, id);
  if (!ok) {
    return NextResponse.json({ error: "Style not found" }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
