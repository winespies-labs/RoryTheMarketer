import { NextRequest, NextResponse } from "next/server";
import { getBrand } from "@/lib/brands";
import { nanoid } from "nanoid";
import {
  readInstagramResearch,
  addSearch,
  deleteSearch,
} from "@/lib/instagram-research-storage";
import type { InstagramSearch, InstagramPost } from "@/lib/instagram-research";

export async function GET(req: NextRequest) {
  const brandId = req.nextUrl.searchParams.get("brand");
  if (!brandId || !getBrand(brandId)) {
    return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
  }

  const data = readInstagramResearch(brandId);

  // Load a specific search with full posts
  const loadId = req.nextUrl.searchParams.get("loadId");
  if (loadId) {
    const search = data.searches.find((s) => s.id === loadId);
    if (!search) {
      return NextResponse.json({ error: "Search not found" }, { status: 404 });
    }
    return NextResponse.json({ search });
  }

  // Default: return metadata only
  const searches = data.searches.map((s) => ({
    id: s.id,
    keyword: s.keyword,
    searchedAt: s.searchedAt,
    resultCount: s.resultCount,
  }));

  return NextResponse.json({ searches });
}

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const brandId = body.brand as string | undefined;
    const keyword = body.keyword as string | undefined;
    const posts = body.posts as InstagramPost[] | undefined;

    if (!brandId || !getBrand(brandId)) {
      return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
    }
    if (!keyword?.trim()) {
      return NextResponse.json({ error: "Keyword is required" }, { status: 400 });
    }
    if (!Array.isArray(posts) || posts.length === 0) {
      return NextResponse.json({ error: "Posts are required" }, { status: 400 });
    }

    const search: InstagramSearch = {
      id: nanoid(),
      keyword: keyword.trim(),
      searchedAt: new Date().toISOString(),
      resultCount: posts.length,
      posts,
    };

    addSearch(brandId, search);

    return NextResponse.json({ ok: true, search: { id: search.id, keyword: search.keyword, searchedAt: search.searchedAt, resultCount: search.resultCount } });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Save failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const brandId = req.nextUrl.searchParams.get("brand");
  const searchId = req.nextUrl.searchParams.get("id");

  if (!brandId || !getBrand(brandId)) {
    return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
  }
  if (!searchId) {
    return NextResponse.json({ error: "Search id is required" }, { status: 400 });
  }

  deleteSearch(brandId, searchId);
  return NextResponse.json({ ok: true });
}
