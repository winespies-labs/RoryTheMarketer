import { NextResponse } from "next/server";
import { BRANDS } from "@/lib/brands";

export async function GET() {
  return NextResponse.json(BRANDS);
}
