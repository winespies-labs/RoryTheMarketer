import { NextRequest, NextResponse } from "next/server";
import { getBrand } from "@/lib/brands";
import { searchAds } from "@/lib/foreplay";
import { writeForeplayAds } from "@/lib/competitor-ads-storage";

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => ({}));
    const brandId = body.brand as string | undefined;
    const domains = body.domains as string[] | undefined;
    const searchTerms = body.searchTerms as string[] | undefined;

    if (!brandId || !getBrand(brandId)) {
      return NextResponse.json({ ok: false, error: "Invalid brand" }, { status: 400 });
    }

    const terms = [
      ...(Array.isArray(domains) ? domains : []),
      ...(Array.isArray(searchTerms) ? searchTerms : []),
    ].filter((t): t is string => typeof t === "string" && t.trim().length > 0);

    if (terms.length === 0) {
      const brand = getBrand(brandId);
      const domain = brand?.domain;
      if (!domain) {
        return NextResponse.json(
          { ok: false, error: "Provide domains or searchTerms, or set brand.domain" },
          { status: 400 }
        );
      }
      terms.push(domain);
    }

    const ads = await searchAds({
      domains: terms.filter((t) => t.includes(".")),
      searchTerms: terms.filter((t) => !t.includes(".")),
      limit: 50,
    });

    const syncedAt = new Date().toISOString();
    writeForeplayAds(brandId, { syncedAt, ads });

    return NextResponse.json({ ok: true, count: ads.length, syncedAt });
  } catch (e) {
    const message = e instanceof Error ? e.message : "Foreplay sync failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
