import fs from "fs";
import path from "path";
import { nanoid } from "nanoid";
import { getBrandDataDir, ensureBrandDataDir } from "@/lib/brands";

export interface ChatMessage {
  id: string;
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export interface Chat {
  id: string;
  brandId: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
}

export interface ChatsData {
  updatedAt: string;
  chats: Chat[];
}

const CHATS_FILENAME = "chats.json";

function getFilePath(brandId: string): string {
  return path.join(getBrandDataDir(brandId), CHATS_FILENAME);
}

function readChatsData(brandId: string): ChatsData {
  const filePath = getFilePath(brandId);
  if (!fs.existsSync(filePath)) return { updatedAt: "", chats: [] };
  try {
    const data = JSON.parse(fs.readFileSync(filePath, "utf-8")) as ChatsData;
    if (!Array.isArray(data?.chats)) return { updatedAt: "", chats: [] };
    return data;
  } catch {
    return { updatedAt: "", chats: [] };
  }
}

function writeChatsData(brandId: string, data: ChatsData): void {
  ensureBrandDataDir(brandId);
  const next: ChatsData = { ...data, updatedAt: new Date().toISOString() };
  fs.writeFileSync(getFilePath(brandId), JSON.stringify(next, null, 2), "utf-8");
}

export function listChats(brandId: string): Omit<Chat, "messages">[] {
  const data = readChatsData(brandId);
  return data.chats
    .map(({ messages: _messages, ...rest }) => rest)
    .sort((a, b) => new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime());
}

export function getChat(brandId: string, chatId: string): Chat | null {
  const data = readChatsData(brandId);
  return data.chats.find((c) => c.id === chatId) ?? null;
}

export function createChat(brandId: string): Chat {
  const data = readChatsData(brandId);
  const now = new Date().toISOString();
  const chat: Chat = {
    id: nanoid(),
    brandId,
    title: "New Chat",
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
  data.chats.push(chat);
  writeChatsData(brandId, data);
  return chat;
}

export function appendMessage(
  brandId: string,
  chatId: string,
  role: "user" | "assistant",
  content: string
): ChatMessage | null {
  const data = readChatsData(brandId);
  const chat = data.chats.find((c) => c.id === chatId);
  if (!chat) return null;
  const msg: ChatMessage = {
    id: nanoid(),
    role,
    content,
    createdAt: new Date().toISOString(),
  };
  chat.messages.push(msg);
  chat.updatedAt = msg.createdAt;
  writeChatsData(brandId, data);
  return msg;
}

export function updateChatTitle(
  brandId: string,
  chatId: string,
  title: string
): boolean {
  const data = readChatsData(brandId);
  const chat = data.chats.find((c) => c.id === chatId);
  if (!chat) return false;
  chat.title = title;
  chat.updatedAt = new Date().toISOString();
  writeChatsData(brandId, data);
  return true;
}

export function deleteChat(brandId: string, chatId: string): boolean {
  const data = readChatsData(brandId);
  const prev = data.chats.length;
  data.chats = data.chats.filter((c) => c.id !== chatId);
  if (data.chats.length === prev) return false;
  writeChatsData(brandId, data);
  return true;
}
