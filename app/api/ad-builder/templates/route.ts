import { NextResponse } from "next/server";
import { listTemplates } from "@/lib/template-registry";

export async function GET() {
  const templates = listTemplates();
  return NextResponse.json({ templates });
}
