import { NextRequest, NextResponse } from "next/server";
import { getBrand } from "@/lib/brands";
import {
  listChats,
  getChat,
  createChat,
  deleteChat,
} from "@/lib/chat-storage";

export async function GET(req: NextRequest) {
  const brand = req.nextUrl.searchParams.get("brand");
  if (!brand || !getBrand(brand)) {
    return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
  }

  const chatId = req.nextUrl.searchParams.get("chatId");
  if (chatId) {
    const chat = getChat(brand, chatId);
    if (!chat) {
      return NextResponse.json({ error: "Chat not found" }, { status: 404 });
    }
    return NextResponse.json({ chat });
  }

  const chats = listChats(brand).map((c) => ({
    id: c.id,
    title: c.title,
    createdAt: c.createdAt,
    updatedAt: c.updatedAt,
  }));
  return NextResponse.json({ chats });
}

export async function POST(req: NextRequest) {
  const body = await req.json();
  const { brand } = body as { brand?: string };
  if (!brand || !getBrand(brand)) {
    return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
  }
  const chat = createChat(brand);
  return NextResponse.json({ chat });
}

export async function DELETE(req: NextRequest) {
  const brand = req.nextUrl.searchParams.get("brand");
  const id = req.nextUrl.searchParams.get("id");
  if (!brand || !getBrand(brand)) {
    return NextResponse.json({ error: "Invalid brand" }, { status: 400 });
  }
  if (!id) {
    return NextResponse.json({ error: "Missing id" }, { status: 400 });
  }
  const ok = deleteChat(brand, id);
  return NextResponse.json({ ok });
}
