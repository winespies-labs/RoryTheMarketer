import { NextRequest, NextResponse } from "next/server";
import { getBrand } from "@/lib/brands";
import { graphPost } from "@/lib/meta-graph";

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { brand, campaignId, dailyBudget, status } = body as {
    brand?: string;
    campaignId?: string;
    dailyBudget?: number; // in dollars (we convert to cents)
    status?: string;
  };

  if (!brand || !getBrand(brand)) {
    return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
  }
  if (!campaignId) {
    return NextResponse.json({ error: "campaignId required" }, { status: 400 });
  }

  try {
    const updates: Record<string, string | number | boolean | undefined> = {};

    if (dailyBudget !== undefined) {
      // Meta expects budget in cents
      updates.daily_budget = Math.round(dailyBudget * 100);
    }
    if (status) {
      updates.status = status;
    }

    if (Object.keys(updates).length === 0) {
      return NextResponse.json({ error: "No updates provided" }, { status: 400 });
    }

    const result = await graphPost<{ success: boolean }>(`/${campaignId}`, updates);

    return NextResponse.json({ ok: true, result });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Update failed";
    return NextResponse.json({ ok: false, error: message }, { status: 500 });
  }
}
