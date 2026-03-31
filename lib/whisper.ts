/**
 * OpenAI Whisper client for video transcription.
 * Env: OPENAI_API_KEY
 */

import OpenAI, { toFile } from "openai";

let _client: OpenAI | null = null;

function getClient(): OpenAI {
  if (!_client) {
    const key = process.env.OPENAI_API_KEY;
    if (!key?.trim()) throw new Error("OPENAI_API_KEY is not set");
    _client = new OpenAI({ apiKey: key.trim() });
  }
  return _client;
}

const MAX_SIZE = 25 * 1024 * 1024; // 25MB Whisper limit

export async function transcribeVideo(videoUrl: string): Promise<string> {
  const res = await fetch(videoUrl);
  if (!res.ok) throw new Error(`Failed to download video: ${res.status}`);

  const contentLength = res.headers.get("content-length");
  if (contentLength && Number(contentLength) > MAX_SIZE) {
    throw new Error("Video exceeds 25MB Whisper limit");
  }

  const buffer = Buffer.from(await res.arrayBuffer());
  if (buffer.length > MAX_SIZE) {
    throw new Error("Video exceeds 25MB Whisper limit");
  }

  const file = await toFile(buffer, "video.mp4", { type: "video/mp4" });

  const client = getClient();
  const transcription = await client.audio.transcriptions.create({
    model: "whisper-1",
    file,
  });

  return transcription.text;
}
