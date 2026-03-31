import { NextRequest, NextResponse } from "next/server";
import Anthropic from "@anthropic-ai/sdk";
import { getBrand } from "@/lib/brands";
import { readMetaComments, writeMetaCommentThemes, readMetaCommentThemes } from "@/lib/meta-comments-storage";

const client = new Anthropic();

export const maxDuration = 60;

export async function GET(req: NextRequest) {
  const brandId = req.nextUrl.searchParams.get("brand");
  if (!brandId || !getBrand(brandId)) {
    return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
  }
  const data = readMetaCommentThemes(brandId);
  return NextResponse.json({ generatedAt: data?.generatedAt ?? null, scope: data?.scope ?? {}, summary: data?.summary ?? "" });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const brandId = body.brand as string | undefined;
  const adId = body.adId as string | undefined;
  const postId = body.postId as string | undefined;

  if (!brandId || !getBrand(brandId)) {
    return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
  }

  const stored = readMetaComments(brandId);
  if (!stored || stored.comments.length === 0) {
    return NextResponse.json({ error: "No stored meta comments for this brand. Run sync first." }, { status: 400 });
  }

  let comments = stored.comments;
  if (adId) comments = comments.filter((c) => c.adId === adId);
  if (postId) comments = comments.filter((c) => c.postId === postId);

  if (comments.length === 0) {
    return NextResponse.json({ error: "No comments match this scope." }, { status: 400 });
  }

  const sample = comments
    .slice(0, 600)
    .map((c) => `- ${c.text.replace(/\s+/g, " ").trim()}`)
    .join("\n");

  const system = `You are a senior performance marketer analyzing Meta ad comments.
Summarize recurring themes with a focus on:
- Objections / concerns
- Questions (product, shipping, price, availability)
- Positive proof points
- Confusion / misconceptions to clarify

Output 2–5 short paragraphs + a bullet list of "Messaging recommendations" (5–10 bullets). Keep it skimmable.`;

  const user = `Brand: ${brandId}
Scope: ${adId ? `adId=${adId}` : postId ? `postId=${postId}` : "all stored comments"}
Comment sample (${Math.min(comments.length, 600)} of ${comments.length}):

${sample}`;

  const msg = await client.messages.create({
    model: "claude-sonnet-4-5",
    max_tokens: 1200,
    system,
    messages: [{ role: "user", content: user }],
  });

  const summary = msg.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("")
    .trim();

  const generatedAt = new Date().toISOString();
  writeMetaCommentThemes(brandId, { generatedAt, scope: { adId, postId }, summary });

  return NextResponse.json({ ok: true, generatedAt, scope: { adId, postId }, summary });
}

