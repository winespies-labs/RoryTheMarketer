"use client";

import { useCallback, useEffect, useState } from "react";
import ChatSidebar from "./components/ChatSidebar";
import MessageList from "./components/MessageList";
import ChatInput from "./components/ChatInput";

const BRAND_ID = "winespies";

interface ChatSummary {
  id: string;
  title: string;
  updatedAt: string;
}

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

function ChatWindow({
  chatId,
  onTitleChange,
}: {
  chatId: string;
  onTitleChange: () => void;
}) {
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const [streamingContent, setStreamingContent] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/chat/history?brand=${BRAND_ID}&chatId=${chatId}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.chat?.messages) setMessages(d.chat.messages);
      })
      .catch(() => {});
  }, [chatId]);

  const sendMessage = useCallback(async () => {
    const text = input.trim();
    if (!text || streaming) return;

    const userMsg: Message = {
      id: "temp-" + Date.now(),
      role: "user",
      content: text,
    };
    const nextMessages = [...messages, userMsg];
    setMessages(nextMessages);
    setInput("");
    setStreaming(true);
    setStreamingContent("");
    setError(null);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: BRAND_ID,
          chatId,
          messages: nextMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
        }),
      });

      if (!res.ok) {
        setStreamingContent(null);
        setStreaming(false);
        const data = await res.json().catch(() => ({}));
        const msg = data?.error ?? data?.details ?? `Request failed (${res.status})`;
        const detail = data?.details && data.details !== msg ? ` — ${data.details}` : "";
        setError((typeof msg === "string" ? msg : data?.error || String(msg)) + detail);
        return;
      }
      if (!res.body) {
        setStreamingContent(null);
        setStreaming(false);
        setError("No response body");
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let accumulated = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        accumulated += decoder.decode(value, { stream: true });
        setStreamingContent(accumulated);
      }

      // Commit assistant message to local state
      const assistantMsg: Message = {
        id: "asst-" + Date.now(),
        role: "assistant",
        content: accumulated,
      };
      setMessages((prev) => [...prev, assistantMsg]);
      setStreamingContent(null);
      onTitleChange();
    } catch (e) {
      setStreamingContent(null);
      setError(e instanceof Error ? e.message : "Network or request failed");
    } finally {
      setStreaming(false);
    }
  }, [input, streaming, messages, chatId, onTitleChange]);

  return (
    <div className="flex-1 flex flex-col min-h-0">
      {error && (
        <div className="mx-6 mt-4 p-4 rounded-lg bg-red-50 border border-red-200 text-red-800 text-sm">
          {error}
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-2 underline hover:no-underline"
          >
            Dismiss
          </button>
        </div>
      )}
      <MessageList messages={messages} streamingContent={streamingContent} />
      <ChatInput
        value={input}
        onChange={setInput}
        onSend={sendMessage}
        disabled={streaming}
      />
    </div>
  );
}

export default function ChatPage() {
  const [chats, setChats] = useState<ChatSummary[]>([]);
  const [activeChatId, setActiveChatId] = useState<string | null>(null);

  const fetchChats = useCallback(async () => {
    try {
      const res = await fetch(`/api/chat/history?brand=${BRAND_ID}`);
      const data = await res.json();
      setChats(data.chats ?? []);
    } catch {
      /* ignore */
    }
  }, []);

  useEffect(() => {
    fetchChats();
  }, [fetchChats]);

  const handleNew = async () => {
    try {
      const res = await fetch("/api/chat/history", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand: BRAND_ID }),
      });
      const data = await res.json();
      if (data.chat) {
        setActiveChatId(data.chat.id);
        fetchChats();
      }
    } catch {
      /* ignore */
    }
  };

  const handleDelete = async (chatId: string) => {
    try {
      await fetch(`/api/chat/history?brand=${BRAND_ID}&id=${chatId}`, {
        method: "DELETE",
      });
      if (activeChatId === chatId) setActiveChatId(null);
      fetchChats();
    } catch {
      /* ignore */
    }
  };

  return (
    <div className="-mx-8 -my-8 flex min-h-screen">
      <ChatSidebar
        chats={chats}
        activeChatId={activeChatId}
        onSelect={setActiveChatId}
        onNew={handleNew}
        onDelete={handleDelete}
      />

      {activeChatId ? (
        <ChatWindow
          key={activeChatId}
          chatId={activeChatId}
          onTitleChange={fetchChats}
        />
      ) : (
        <div className="flex-1 flex items-center justify-center">
          <div className="text-center">
            <h2 className="text-2xl font-semibold text-foreground mb-2">
              Chat with Rory
            </h2>
            <p className="text-muted text-sm max-w-md">
              Your AI marketing strategist with full brand context.
              Start a new chat to get advice on copy, campaigns, strategy, and more.
            </p>
            <button
              onClick={handleNew}
              className="mt-6 px-5 py-2.5 text-sm font-medium rounded-lg bg-accent text-white hover:bg-accent/90 transition-colors"
            >
              Start a conversation
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
