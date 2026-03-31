import { NextResponse } from "next/server";
import fs from "fs";
import path from "path";

const CORPUS_PATH = path.join(
  process.cwd(),
  "knowledge/competitor-intel/last-bottle/lbw-email-corpus.md"
);

export async function GET() {
  if (!fs.existsSync(CORPUS_PATH)) {
    return NextResponse.json({ emails: [] });
  }

  const raw = fs.readFileSync(CORPUS_PATH, "utf-8");
  const emailBlocks = raw.split(/^## EMAIL \d+/m).slice(1);

  const emails = emailBlocks.map((block, i) => {
    const lines = block.trim().split("\n");
    const get = (prefix: string) =>
      lines.find((l) => l.startsWith(prefix))?.replace(prefix, "").trim() || "";

    return {
      id: String(i + 1).padStart(3, "0"),
      date: get("**Date:**"),
      subject: get("**Subject:**"),
      wine: get("**Wine:**"),
      score: get("**Score:**"),
      price: get("**Price:**"),
    };
  });

  return NextResponse.json({ emails, total: emails.length });
}
