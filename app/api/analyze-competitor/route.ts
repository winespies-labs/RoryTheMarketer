import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getBrand } from "@/lib/brands";
import { readForeplayAds, readAdsLibraryResults } from "@/lib/competitor-ads-storage";

const client = new Anthropic();

export const maxDuration = 60;

type AnalyzeFromLibrary = {
  brand: string;
  source: "foreplay" | "ads_library";
  id: string;
};

type AnalyzeInline = {
  imageUrl?: string;
  copy?: string;
  pageName?: string;
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as AnalyzeFromLibrary | AnalyzeInline;

    const fromLibrary = "source" in body && "brand" in body && "id" in body;
    let copy = "";
    let imageUrl: string | undefined;
    let pageName: string | undefined;

    if (fromLibrary) {
      const { brand: brandId, source, id } = body as AnalyzeFromLibrary;
      if (!brandId || !getBrand(brandId)) {
        return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
      }
      if (source === "foreplay") {
        const { ads } = readForeplayAds(brandId);
        const ad = ads.find((a) => a.id === id);
        if (!ad) return NextResponse.json({ error: "Foreplay ad not found" }, { status: 404 });
        copy = [ad.headline, ad.body].filter(Boolean).join("\n\n");
        imageUrl = ad.imageUrl;
        pageName = ad.pageName;
      } else {
        const { results } = readAdsLibraryResults(brandId);
        const ad = results.find((a) => a.id === id);
        if (!ad) return NextResponse.json({ error: "Ads Library ad not found" }, { status: 404 });
        const bodies = ad.ad_creative_bodies ?? [];
        copy = bodies.join("\n\n");
        imageUrl = ad.ad_snapshot_url;
        pageName = ad.page_name;
      }
    } else {
      const inline = body as AnalyzeInline;
      copy = inline.copy ?? "";
      imageUrl = inline.imageUrl;
      pageName = inline.pageName;
    }

    if (!copy?.trim() && !imageUrl) {
      return NextResponse.json(
        { error: "Provide copy and/or imageUrl, or use library reference" },
        { status: 400 }
      );
    }

    const content: Anthropic.MessageParam["content"] = [];
    if (imageUrl) {
      try {
        const imageRes = await fetch(imageUrl);
        const buf = await imageRes.arrayBuffer();
        const base64 = Buffer.from(buf).toString("base64");
        const contentType = imageRes.headers.get("content-type") ?? "image/jpeg";
        content.push({
          type: "image",
          source: {
            type: "base64",
            media_type: contentType.startsWith("image/") ? (contentType as "image/jpeg" | "image/png" | "image/gif" | "image/webp") : "image/jpeg",
            data: base64,
          },
        });
      } catch {
        // skip image if fetch fails
      }
    }
    content.push({
      type: "text",
      text: `Analyze this competitor ad${pageName ? ` (page: ${pageName})` : ""}.\n\nCopy:\n${copy || "(no text)"}\n\nProvide: 1) What works (hook, CTA, angle). 2) What to avoid or differentiate. 3) One concrete idea to test for our brand.`,
    });

    const msg = await client.messages.create({
      model: "claude-sonnet-4-5",
      max_tokens: 1500,
      messages: [{ role: "user", content }],
    });

    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === "text")
      .map((b) => b.text)
      .join("");

    return NextResponse.json({ analysis: text });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Analysis failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
