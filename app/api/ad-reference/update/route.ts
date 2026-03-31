import { NextRequest, NextResponse } from "next/server";
import { updateReferenceAd } from "@/lib/reference-ads";
import type { ReferenceAdUpdateInput } from "@/lib/reference-ads";
import path from "path";

export const maxDuration = 30;

export async function PUT(req: NextRequest) {
  try {
    const contentType = req.headers.get("content-type") || "";
    let input: ReferenceAdUpdateInput;
    let imageBuffer: Buffer | undefined;
    let imageExt: string | undefined;

    if (contentType.includes("multipart/form-data")) {
      const formData = await req.formData();
      const dataStr = formData.get("data") as string | null;
      const imageFile = formData.get("image") as File | null;

      if (!dataStr) {
        return NextResponse.json({ error: "Data JSON is required" }, { status: 400 });
      }
      input = JSON.parse(dataStr);

      if (imageFile) {
        imageBuffer = Buffer.from(await imageFile.arrayBuffer());
        imageExt = path.extname(imageFile.name) || ".png";
      }
    } else {
      input = await req.json();
    }

    if (!input.id) {
      return NextResponse.json({ error: "id is required" }, { status: 400 });
    }

    const referenceAd = updateReferenceAd(input, imageBuffer, imageExt);
    if (!referenceAd) {
      return NextResponse.json({ error: "Reference ad not found" }, { status: 404 });
    }

    return NextResponse.json({ referenceAd });
  } catch (err) {
    console.error("Error updating reference ad:", err);
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "Failed to update reference ad" },
      { status: 500 },
    );
  }
}
