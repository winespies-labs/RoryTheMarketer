"use client";

import { useEffect, useRef, useState } from "react";
import { nanoid } from "nanoid";
import AdElementsPanel from "@/app/ads-manager/workshop/components/AdElementsPanel";
import {
  type AdElements,
  type CreativeImage,
  type ChatMessage,
  CTA_OPTIONS,
  type CtaType,
} from "@/app/ads-manager/workshop/types";

const BRAND_ID = "winespies";
const DEFAULTS_KEY = "ws_ad_defaults";

type AdSetOption = {
  id: string;
  name: string;
  status: string;
  effective_status: string;
};

type PublishStatus = "idle" | "publishing" | "success" | "error";

// ── Facebook-style ad preview ──

function AdPreview({
  elements,
  imageUrl,
}: {
  elements: AdElements;
  imageUrl: string | null;
}) {
  const ctaLabel = CTA_OPTIONS.find((o) => o.value === elements.ctaType)?.label ?? "Shop Now";

  return (
    <div className="bg-white rounded-lg border border-border shadow-sm max-w-[400px] mx-auto">
      {/* Header */}
      <div className="px-4 py-3 flex items-center gap-2">
        <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center text-xs font-bold text-accent">
          WS
        </div>
        <div>
          <div className="text-sm font-semibold">Wine Spies</div>
          <div className="text-xs text-muted">Sponsored</div>
        </div>
      </div>

      {/* Primary Text */}
      <div className="px-4 pb-2">
        <p className="text-sm whitespace-pre-wrap">
          {elements.primaryText || <span className="text-muted italic">Primary text...</span>}
        </p>
      </div>

      {/* Image */}
      <div className="aspect-square bg-border/20 relative">
        {imageUrl ? (
          <img src={imageUrl} alt="Ad creative" className="w-full h-full object-cover" />
        ) : (
          <div className="w-full h-full flex items-center justify-center text-muted text-sm">
            Upload or generate an image
          </div>
        )}
      </div>

      {/* Link bar */}
      <div className="px-4 py-3 border-t border-border flex items-center justify-between">
        <div className="flex-1 min-w-0 mr-3">
          <div className="text-xs text-muted uppercase truncate">
            {elements.destinationUrl
              ? (() => { try { return new URL(elements.destinationUrl).hostname; } catch { return "website.com"; } })()
              : "website.com"}
          </div>
          <div className="text-sm font-semibold truncate">
            {elements.headline || <span className="text-muted italic">Headline...</span>}
          </div>
          <div className="text-xs text-muted truncate">
            {elements.description || <span className="italic">Description...</span>}
          </div>
        </div>
        <button className="px-3 py-1.5 text-xs font-semibold bg-border/50 rounded whitespace-nowrap">
          {ctaLabel}
        </button>
      </div>
    </div>
  );
}

// ── Main Workshop Page ──

export default function WorkshopPage() {
  // Ad elements
  const [elements, setElements] = useState<AdElements>({
    headline: "",
    primaryText: "",
    description: "",
    ctaType: "SHOP_NOW",
    destinationUrl: "",
  });

  // Creatives
  const [creatives, setCreatives] = useState<CreativeImage[]>([]);
  const [selectedCreativeId, setSelectedCreativeId] = useState<string | null>(null);

  // Ad set selector
  const [adsets, setAdsets] = useState<AdSetOption[]>([]);
  const [selectedAdsetId, setSelectedAdsetId] = useState("");
  const [adName, setAdName] = useState("");

  // Publish
  const [publishStatus, setPublishStatus] = useState<PublishStatus>("idle");
  const [publishResult, setPublishResult] = useState<string>("");

  // Image generation
  const [imagePrompt, setImagePrompt] = useState("");
  const [generating, setGenerating] = useState(false);

  // Chat
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [streaming, setStreaming] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // Load defaults from localStorage on mount
  useEffect(() => {
    try {
      const raw = localStorage.getItem(DEFAULTS_KEY);
      if (raw) {
        const d = JSON.parse(raw);
        setElements((prev) => ({
          ...prev,
          destinationUrl: d.destinationUrl ?? prev.destinationUrl,
          ctaType: d.ctaType ?? prev.ctaType,
        }));
      }
    } catch {}
  }, []);

  // Fetch ad sets
  useEffect(() => {
    fetch(`/api/meta-ads/adsets-live?brand=${BRAND_ID}`)
      .then((r) => r.json())
      .then((d) => {
        if (d.adsets) setAdsets(d.adsets);
      })
      .catch(() => {});
  }, []);

  // Scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  // Selected image URL
  const selectedImage = creatives.find((c) => c.id === selectedCreativeId);
  const imageUrl = selectedImage ? `data:${selectedImage.mimeType};base64,${selectedImage.base64}` : null;

  // ── Image upload ──
  const handleImageUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      const [meta, base64] = result.split(",");
      const mimeType = meta.match(/:(.*?);/)?.[1] ?? "image/png";
      const id = nanoid();
      const img: CreativeImage = { id, base64, mimeType };
      setCreatives((prev) => [...prev, img]);
      setSelectedCreativeId(id);
    };
    reader.readAsDataURL(file);
    e.target.value = "";
  };

  // ── Image generation ──
  const handleGenerateImage = async () => {
    if (!imagePrompt.trim()) return;
    setGenerating(true);
    try {
      const res = await fetch("/api/workshop/generate-image", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt: imagePrompt }),
      });
      const data = await res.json();
      if (data.error) {
        setPublishResult(data.error);
        return;
      }
      if (data.images?.length) {
        const newImages: CreativeImage[] = data.images.map((img: { base64: string; mimeType: string }) => ({
          id: nanoid(),
          base64: img.base64,
          mimeType: img.mimeType,
          prompt: imagePrompt,
        }));
        setCreatives((prev) => [...prev, ...newImages]);
        setSelectedCreativeId(newImages[0].id);
        setImagePrompt("");
      }
    } catch {
      setPublishResult("Image generation failed");
    } finally {
      setGenerating(false);
    }
  };

  // ── Publish ──
  const handlePublish = async () => {
    if (!selectedImage) { setPublishResult("Select an image first"); return; }
    if (!selectedAdsetId) { setPublishResult("Select an ad set first"); return; }
    if (!elements.headline.trim()) { setPublishResult("Headline is required"); return; }

    setPublishStatus("publishing");
    setPublishResult("");
    try {
      const res = await fetch("/api/workshop/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: BRAND_ID,
          adsetId: selectedAdsetId,
          adName: adName || undefined,
          imageBase64: selectedImage.base64,
          primaryText: elements.primaryText,
          headline: elements.headline,
          description: elements.description,
          destinationUrl: elements.destinationUrl,
          ctaType: elements.ctaType,
          status: "PAUSED",
        }),
      });
      const data = await res.json();
      if (data.ok) {
        setPublishStatus("success");
        setPublishResult(`Published! Ad ID: ${data.metaAdId}`);
      } else {
        setPublishStatus("error");
        setPublishResult(data.error ?? "Publish failed");
      }
    } catch {
      setPublishStatus("error");
      setPublishResult("Publish request failed");
    }
  };

  // ── Chat ──
  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text || streaming) return;

    const userMsg: ChatMessage = { id: nanoid(), role: "user", content: text };
    const assistantMsg: ChatMessage = { id: nanoid(), role: "assistant", content: "" };

    setMessages((prev) => [...prev, userMsg, assistantMsg]);
    setChatInput("");
    setStreaming(true);

    try {
      const allMessages = [...messages, userMsg].map((m) => ({ role: m.role, content: m.content }));
      const res = await fetch("/api/workshop/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: BRAND_ID,
          messages: allMessages,
          adContext: elements,
        }),
      });

      if (!res.ok || !res.body) {
        setMessages((prev) =>
          prev.map((m) => m.id === assistantMsg.id ? { ...m, content: "Failed to get response" } : m)
        );
        return;
      }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
        const captured = fullText;
        setMessages((prev) =>
          prev.map((m) => m.id === assistantMsg.id ? { ...m, content: captured } : m)
        );
      }
    } catch {
      setMessages((prev) =>
        prev.map((m) => m.id === assistantMsg.id ? { ...m, content: "Error: request failed" } : m)
      );
    } finally {
      setStreaming(false);
    }
  };

  return (
    <div className="flex gap-0 -mx-6 -mb-6" style={{ height: "calc(100vh - 180px)" }}>
      {/* Left: Ad Elements + Publish */}
      <div className="flex flex-col" style={{ width: 320 }}>
        <AdElementsPanel
          elements={elements}
          onChange={setElements}
          creatives={creatives}
          selectedCreativeId={selectedCreativeId}
          onSelectCreative={setSelectedCreativeId}
        />

        {/* Publish controls */}
        <div className="p-4 border-t border-r border-border bg-white space-y-3">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Ad Name</label>
            <input
              type="text"
              value={adName}
              onChange={(e) => setAdName(e.target.value)}
              placeholder="Optional ad name..."
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">Ad Set</label>
            <select
              value={selectedAdsetId}
              onChange={(e) => setSelectedAdsetId(e.target.value)}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent bg-white"
            >
              <option value="">Select ad set...</option>
              {adsets.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name} ({a.effective_status})
                </option>
              ))}
            </select>
          </div>

          <button
            onClick={handlePublish}
            disabled={publishStatus === "publishing"}
            className="w-full px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
          >
            {publishStatus === "publishing" ? "Publishing..." : "Publish to Meta (Paused)"}
          </button>

          {publishResult && (
            <div className={`text-xs px-3 py-2 rounded-md ${
              publishStatus === "success" ? "bg-success/10 text-success" : "bg-danger/10 text-danger"
            }`}>
              {publishResult}
            </div>
          )}
        </div>
      </div>

      {/* Center: Preview + Image upload/generate */}
      <div className="flex-1 flex flex-col border-x border-border bg-gray-50 overflow-y-auto">
        <div className="p-6 flex-1 flex flex-col items-center justify-center">
          <AdPreview elements={elements} imageUrl={imageUrl} />
        </div>

        {/* Image controls */}
        <div className="p-4 border-t border-border bg-white space-y-3">
          <div className="flex items-center gap-2">
            <label className="flex-1">
              <span className="block text-xs font-medium text-muted mb-1">Upload Image</span>
              <input
                type="file"
                accept="image/*"
                onChange={handleImageUpload}
                className="w-full text-sm file:mr-3 file:px-3 file:py-1.5 file:text-xs file:font-medium file:border-0 file:rounded-md file:bg-accent file:text-white file:cursor-pointer hover:file:opacity-90"
              />
            </label>
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">Generate with AI</label>
            <div className="flex gap-2">
              <input
                type="text"
                value={imagePrompt}
                onChange={(e) => setImagePrompt(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && handleGenerateImage()}
                placeholder="Describe your ad image..."
                className="flex-1 px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
                disabled={generating}
              />
              <button
                onClick={handleGenerateImage}
                disabled={generating || !imagePrompt.trim()}
                className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity whitespace-nowrap"
              >
                {generating ? "Generating..." : "Generate"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* Right: AI Chat */}
      <div className="flex flex-col bg-white" style={{ width: 360 }}>
        <div className="p-4 border-b border-border">
          <h2 className="text-sm font-semibold">AI Copywriter</h2>
          <p className="text-xs text-muted mt-0.5">Get help writing ad copy</p>
        </div>

        {/* Messages */}
        <div className="flex-1 overflow-y-auto p-4 space-y-3">
          {messages.length === 0 && (
            <div className="text-center text-sm text-muted py-8">
              Ask for headline ideas, copy variations, or feedback on your ad.
            </div>
          )}
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`text-sm ${
                msg.role === "user"
                  ? "bg-accent/10 text-foreground rounded-lg p-3 ml-8"
                  : "text-foreground p-1"
              }`}
            >
              {msg.role === "assistant" && !msg.content && streaming && (
                <span className="text-muted italic">Thinking...</span>
              )}
              <div className="whitespace-pre-wrap">{msg.content}</div>
            </div>
          ))}
          <div ref={chatEndRef} />
        </div>

        {/* Input */}
        <div className="p-4 border-t border-border">
          <div className="flex gap-2">
            <input
              type="text"
              value={chatInput}
              onChange={(e) => setChatInput(e.target.value)}
              onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && sendChat()}
              placeholder="Ask about copy, hooks, CTAs..."
              className="flex-1 px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
              disabled={streaming}
            />
            <button
              onClick={sendChat}
              disabled={streaming || !chatInput.trim()}
              className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
            >
              Send
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
