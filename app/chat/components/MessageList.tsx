"use client";

import { useEffect, useRef } from "react";

interface Message {
  id: string;
  role: "user" | "assistant";
  content: string;
}

interface MessageListProps {
  messages: Message[];
  streamingContent: string | null;
}

export default function MessageList({ messages, streamingContent }: MessageListProps) {
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, streamingContent]);

  return (
    <div className="flex-1 overflow-y-auto px-6 py-6 space-y-5">
      {messages.map((msg) => (
        <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
          <div
            className={`max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed ${
              msg.role === "user"
                ? "bg-accent text-white"
                : "bg-background border border-border text-foreground"
            }`}
          >
            {msg.role === "assistant" && (
              <div className="text-[11px] font-semibold text-muted mb-1">Rory</div>
            )}
            <div className="whitespace-pre-wrap">{msg.content}</div>
          </div>
        </div>
      ))}

      {streamingContent !== null && (
        <div className="flex justify-start">
          <div className="max-w-[80%] rounded-xl px-4 py-3 text-sm leading-relaxed bg-background border border-border text-foreground">
            <div className="text-[11px] font-semibold text-muted mb-1">Rory</div>
            <div className="whitespace-pre-wrap">
              {streamingContent || <span className="text-muted animate-pulse">Thinking...</span>}
            </div>
          </div>
        </div>
      )}

      <div ref={bottomRef} />
    </div>
  );
}
