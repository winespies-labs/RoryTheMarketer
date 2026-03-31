import { NextRequest, NextResponse } from "next/server";
import { getBrand } from "@/lib/brands";
import { searchAdsArchive } from "@/lib/ads-library";
import {
  readAdsLibraryResults,
  writeAdsLibraryResults,
} from "@/lib/competitor-ads-storage";

export async function GET(req: NextRequest) {
  const brandId = req.nextUrl.searchParams.get("brand");
  const q = req.nextUrl.searchParams.get("q")?.trim();
  const countriesParam = req.nextUrl.searchParams.get("countries");

  if (!brandId || !getBrand(brandId)) {
    return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
  }
  if (!q) {
    return NextResponse.json({ error: "Missing query (q)" }, { status: 400 });
  }

  try {
    const countries = countriesParam
      ? countriesParam.split(",").map((c) => c.trim()).filter(Boolean)
      : undefined;
    const results = await searchAdsArchive({
      searchTerms: q,
      adReachedCountries: countries?.length ? countries : ["US"],
      limit: 100,
    });

    const searchedAt = new Date().toISOString();
    writeAdsLibraryResults(brandId, {
      searchedAt,
      query: q,
      countries: countries,
      results,
    });

    return NextResponse.json({
      ok: true,
      count: results.length,
      searchedAt,
      results,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ads Library search failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await req.json().catch(() => ({}));
  const brandId = body.brand as string | undefined;
  const q = (body.q ?? body.query) as string | undefined;
  const countries = body.countries as string[] | undefined;

  if (!brandId || !getBrand(brandId)) {
    return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
  }
  if (!q?.trim()) {
    return NextResponse.json({ error: "Missing q or query" }, { status: 400 });
  }

  try {
    const results = await searchAdsArchive({
      searchTerms: q.trim(),
      adReachedCountries: Array.isArray(countries) && countries.length > 0 ? countries : ["US"],
      limit: 100,
    });

    const searchedAt = new Date().toISOString();
    writeAdsLibraryResults(brandId, {
      searchedAt,
      query: q.trim(),
      countries: Array.isArray(countries) ? countries : undefined,
      results,
    });

    return NextResponse.json({
      ok: true,
      count: results.length,
      searchedAt,
      results,
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Ads Library search failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
