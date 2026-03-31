import { NextRequest, NextResponse } from "next/server";
import { getBrand } from "@/lib/brands";
import { transcribeVideo } from "@/lib/whisper";
import { updatePostTranscript } from "@/lib/instagram-research-storage";

export const maxDuration = 60;

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const brandId = body.brand as string | undefined;
    const searchId = body.searchId as string | undefined;
    const postId = body.postId as string | undefined;
    const videoUrl = body.videoUrl as string | undefined;

    if (!brandId || !getBrand(brandId)) {
      return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
    }
    if (!postId) {
      return NextResponse.json({ error: "postId is required" }, { status: 400 });
    }
    if (!videoUrl) {
      return NextResponse.json({ error: "videoUrl is required" }, { status: 400 });
    }

    const transcript = await transcribeVideo(videoUrl);

    if (searchId) {
      updatePostTranscript(brandId, searchId, postId, transcript);
    }

    return NextResponse.json({ ok: true, postId, transcript });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Transcription failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
