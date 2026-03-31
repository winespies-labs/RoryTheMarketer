import { NextRequest, NextResponse } from "next/server";
import { getBrand } from "@/lib/brands";
import {
  mergeReviews,
  readReviews,
  writeReviews,
} from "@/lib/reviews-storage";
import type { ReviewSource } from "@/lib/reviews";

/** Parse a single CSV line respecting quoted fields. */
function parseCSVLine(line: string): string[] {
  const out: string[] = [];
  let i = 0;
  while (i < line.length) {
    if (line[i] === '"') {
      let end = i + 1;
      while (end < line.length) {
        const next = line.indexOf('"', end);
        if (next === -1) break;
        if (line[next + 1] === '"') {
          end = next + 2;
          continue;
        }
        out.push(line.slice(i + 1, next).replace(/""/g, '"'));
        end = next + 1;
        if (line[end] === ",") end++;
        i = end;
        break;
      }
      if (end >= line.length) {
        out.push(line.slice(i + 1).replace(/""/g, '"'));
        break;
      }
    } else {
      const comma = line.indexOf(",", i);
      const value = (comma === -1 ? line.slice(i) : line.slice(i, comma)).trim();
      out.push(value);
      i = comma === -1 ? line.length : comma + 1;
    }
  }
  return out;
}

/** CSV: "Review User Email","Review Title","Review Content" or without quotes */
function parseCSV(csv: string): { title: string; content: string; author?: string }[] {
  const lines = csv.trim().split(/\r?\n/).filter(Boolean);
  if (lines.length < 2) return [];

  const headerRow = parseCSVLine(lines[0]);
  const header = headerRow.map((c) => c.toLowerCase());
  const titleIdx = header.findIndex((c) => c.includes("title"));
  const contentIdx = header.findIndex((c) => c.includes("content"));
  const emailIdx = header.findIndex((c) => c.includes("email"));
  const ti = titleIdx >= 0 ? titleIdx : 1;
  const ci = contentIdx >= 0 ? contentIdx : 2;
  const ei = emailIdx >= 0 ? emailIdx : -1;

  const rows: { title: string; content: string; author?: string }[] = [];
  for (let i = 1; i < lines.length; i++) {
    const parts = parseCSVLine(lines[i]);
    const title = (parts[ti] ?? "").trim();
    const content = (parts[ci] ?? "").trim();
    if (!content) continue;
    const author = ei >= 0 ? parts[ei]?.trim() : undefined;
    rows.push({ title, content, author });
  }
  return rows;
}

export async function POST(req: NextRequest) {
  const contentType = req.headers.get("content-type") ?? "";
  let brandId: string;
  let source: ReviewSource = "unknown";
  let items: { title?: string; content: string; author?: string }[] = [];

  if (contentType.includes("multipart/form-data")) {
    const formData = await req.formData();
    brandId = (formData.get("brand") as string) ?? "";
    const file = formData.get("file") as File | null;
    const sourceParam = (formData.get("source") as string) ?? "trustpilot";
    if (sourceParam === "trustpilot" || sourceParam === "app_store") {
      source = sourceParam;
    }
    if (!file) {
      return NextResponse.json({ error: "Missing file" }, { status: 400 });
    }
    const text = await file.text();
    if (file.name.endsWith(".csv")) {
      items = parseCSV(text);
    } else {
      try {
        const json = JSON.parse(text) as { reviews?: { title?: string; content: string; author?: string }[] };
        items = Array.isArray(json.reviews) ? json.reviews : [];
      } catch {
        return NextResponse.json(
          { error: "File must be CSV or JSON with { reviews: [...] }" },
          { status: 400 }
        );
      }
    }
  } else {
    const body = await req.json().catch(() => ({}));
    brandId = body.brand;
    if (body.source === "trustpilot" || body.source === "app_store") {
      source = body.source;
    }
    const list = body.reviews;
    if (!Array.isArray(list)) {
      return NextResponse.json(
        { error: "Missing brand or reviews array (e.g. { brand, reviews: [{ title, content }] })" },
        { status: 400 }
      );
    }
    items = list.map((r: { title?: string; content?: string; author?: string }) => ({
      title: r.title,
      content: typeof r.content === "string" ? r.content : String(r.content ?? ""),
      author: r.author,
    })).filter((r: { content: string }) => r.content);
  }

  if (!brandId) {
    return NextResponse.json({ error: "Missing brand" }, { status: 400 });
  }
  if (!getBrand(brandId)) {
    return NextResponse.json({ error: "Unknown brand" }, { status: 400 });
  }

  const now = new Date().toISOString();
  const incoming = items.map((r) => ({
    source,
    title: r.title || undefined,
    content: r.content,
    author: r.author || undefined,
    createdAt: now,
  }));

  const { added, total } = mergeReviews(brandId, incoming);
  const data = readReviews(brandId);

  return NextResponse.json({
    ok: true,
    added,
    total,
    updatedAt: data.updatedAt,
  });
}
