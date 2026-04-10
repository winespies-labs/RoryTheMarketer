"use client";

import { useState, useEffect, useCallback, useRef, Suspense } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { calculateFK, getFKLevel, type FKResult } from "@/lib/flesch-kincaid";
import EditorPanel from "./components/EditorPanel";
import ResearchPanel from "./components/ResearchPanel";
import ReviewPanel, { type CritiqueData } from "./components/ReviewPanel";
import PublishPanel from "./components/PublishPanel";
import ScoreRing from "./components/ScoreRing";
import type { CardStatus } from "./components/CritiqueCard";

interface Writeup {
  id: string;
  title: string;
  content: string;
  status: "draft" | "published";
  score: number | null;
  createdAt: string;
  updatedAt: string;
}

interface WineDetails {
  wineName: string;
  varietal: string;
  region: string;
  points: string;
  priceDiscount: string;
  tastingNotes: string;
  scarcityAngle: string;
}

const BRAND = "winespies";
const AUTO_SAVE_INTERVAL = 30000;
const TABS = ["Research", "Review", "Publish"] as const;
type Tab = (typeof TABS)[number];

function EditorPageInner() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const writeupId = searchParams.get("id");

  // Editor state
  const [title, setTitle] = useState("");
  const [content, setContent] = useState("");
  const [fk, setFk] = useState<FKResult>({ gradeLevel: 0, words: 0, sentences: 0, syllables: 0 });
  const [activeWriteupId, setActiveWriteupId] = useState<string | null>(null);
  const [saveStatus, setSaveStatus] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [writeupStatus, setWriteupStatus] = useState<"draft" | "published">("draft");
  const [lastSavedAt, setLastSavedAt] = useState<string | null>(null);

  // Wine metadata
  const [wineDetails, setWineDetails] = useState<WineDetails>({
    wineName: "", varietal: "", region: "", points: "", priceDiscount: "", tastingNotes: "", scarcityAngle: "",
  });

  // Tabs
  const [activeTab, setActiveTab] = useState<Tab>("Research");

  // Critique
  const [critiqueData, setCritiqueData] = useState<CritiqueData | null>(null);
  const [critiqueLoading, setCritiqueLoading] = useState(false);
  const [itemStatuses, setItemStatuses] = useState<Record<string, CardStatus>>({});

  // Publishing
  const [publishing, setPublishing] = useState(false);

  // Refs
  const fkTimerRef = useRef<ReturnType<typeof setTimeout>>(null);
  const autoSaveRef = useRef<ReturnType<typeof setInterval>>(null);
  const lastSavedContentRef = useRef(content);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const [notification, setNotification] = useState<string | null>(null);

  // Derived
  const overallScore = critiqueData?.overallScore ?? null;

  // Debounced FK calculation
  useEffect(() => {
    if (fkTimerRef.current) clearTimeout(fkTimerRef.current);
    fkTimerRef.current = setTimeout(() => {
      setFk(calculateFK(content));
    }, 300);
    return () => { if (fkTimerRef.current) clearTimeout(fkTimerRef.current); };
  }, [content]);

  // Load writeup from URL param — re-run if writeupId becomes available after mount
  useEffect(() => {
    if (!writeupId) return;
    fetch(`/api/writeups/${writeupId}?brand=${BRAND}`)
      .then((res) => res.ok ? res.json() : null)
      .then((w: Writeup | null) => {
        if (!w) return;
        setTitle(w.title);
        setContent(w.content);
        setActiveWriteupId(w.id);
        setWriteupStatus(w.status);
        setLastSavedAt(w.updatedAt);
        lastSavedContentRef.current = w.content;
      })
      .catch(() => {});
  }, [writeupId]);

  // Save draft
  const saveDraft = useCallback(async () => {
    if (!content.trim()) return;
    const saveTitle = title.trim() || content.trim().split("\n")[0].slice(0, 60) || "Untitled";
    setSaveStatus("saving");

    try {
      if (activeWriteupId) {
        const res = await fetch(`/api/writeups/${activeWriteupId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brand: BRAND, title: saveTitle, content,
            status: writeupStatus,
            score: overallScore,
          }),
        });
        if (res.ok) {
          const updated = await res.json();
          if (!title.trim()) setTitle(saveTitle);
          setLastSavedAt(updated.updatedAt);
          lastSavedContentRef.current = content;
          setSaveStatus("saved");
        } else {
          setSaveStatus("error");
        }
      } else {
        const res = await fetch("/api/writeups", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brand: BRAND, title: saveTitle, content,
            status: writeupStatus,
            score: overallScore,
          }),
        });
        if (res.ok) {
          const writeup = await res.json();
          setActiveWriteupId(writeup.id);
          if (!title.trim()) setTitle(saveTitle);
          setLastSavedAt(writeup.updatedAt);
          lastSavedContentRef.current = content;
          setSaveStatus("saved");
        } else {
          setSaveStatus("error");
        }
      }
    } catch {
      setSaveStatus("error");
    }

    setTimeout(() => setSaveStatus("idle"), 2000);
  }, [content, title, activeWriteupId, writeupStatus, overallScore]);

  // Auto-save every 30s
  useEffect(() => {
    autoSaveRef.current = setInterval(() => {
      if (content.trim() && content !== lastSavedContentRef.current) {
        saveDraft();
      }
    }, AUTO_SAVE_INTERVAL);
    return () => { if (autoSaveRef.current) clearInterval(autoSaveRef.current); };
  }, [saveDraft, content]);

  // Run structured review
  const runReview = async () => {
    if (!content.trim()) return;
    setCritiqueLoading(true);
    try {
      const res = await fetch("/api/critique", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand: BRAND, draft: `Title: ${title}\n\n${content}` }),
      });
      if (res.ok) {
        const data = await res.json();
        setCritiqueData(data);
        setItemStatuses({});
      } else if (res.status === 429) {
        setNotification("Rate limited — try again in 30s");
        setTimeout(() => setNotification(null), 5000);
      } else {
        const data = await res.json().catch(() => ({}));
        setNotification(data.error || "Review failed");
        setTimeout(() => setNotification(null), 5000);
      }
    } catch {
      setNotification("Network error");
      setTimeout(() => setNotification(null), 5000);
    }
    setCritiqueLoading(false);
  };

  // Apply fix
  const applyFix = (line: string, fix: string, itemId: string) => {
    if (content.includes(line)) {
      setContent(content.replace(line, fix));
      setItemStatuses((prev) => ({ ...prev, [itemId]: "applied" }));
    } else {
      navigator.clipboard.writeText(fix);
      setNotification("Text not found — fix copied to clipboard");
      setTimeout(() => setNotification(null), 3000);
      setItemStatuses((prev) => ({ ...prev, [itemId]: "applied" }));
    }
  };

  // Dismiss item
  const dismissItem = (itemId: string) => {
    setItemStatuses((prev) => ({ ...prev, [itemId]: "dismissed" }));
  };

  // Click item — scroll to text in editor
  const clickItem = (_itemId: string, line: string) => {
    const textarea = textareaRef.current;
    if (!textarea) return;
    const idx = content.indexOf(line);
    if (idx === -1) return;
    textarea.focus();
    textarea.setSelectionRange(idx, idx + line.length);
    const linesBefore = content.slice(0, idx).split("\n").length;
    const lineHeight = 20;
    textarea.scrollTop = Math.max(0, (linesBefore - 3) * lineHeight);
  };

  // Publish / unpublish
  const handlePublish = async () => {
    setPublishing(true);
    setWriteupStatus("published");
    if (activeWriteupId) {
      await fetch(`/api/writeups/${activeWriteupId}`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: BRAND, status: "published", score: overallScore,
          title: title || "Untitled", content,
        }),
      });
    } else {
      const res = await fetch("/api/writeups", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: BRAND, title: title || "Untitled", content,
          status: "published", score: overallScore,
        }),
      });
      if (res.ok) {
        const writeup = await res.json();
        setActiveWriteupId(writeup.id);
        setLastSavedAt(writeup.updatedAt);
      }
    }
    setPublishing(false);
  };

  const handleUnpublish = async () => {
    if (!activeWriteupId) return;
    setPublishing(true);
    setWriteupStatus("draft");
    await fetch(`/api/writeups/${activeWriteupId}`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brand: BRAND, status: "draft", title, content }),
    });
    setPublishing(false);
  };

  // Insert content handler for ResearchPanel
  const handleInsertContent = (text: string) => {
    setContent(text);
  };

  const fkLevel = getFKLevel(fk.gradeLevel);
  const fkBadgeColor =
    fkLevel === "green" ? "text-green-600" : fkLevel === "yellow" ? "text-amber-600" : "text-red-500";

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)]">
      {/* Notification toast */}
      {notification && (
        <div className="fixed top-4 right-4 z-50 px-4 py-2 rounded-lg bg-foreground text-background text-sm shadow-lg">
          {notification}
        </div>
      )}

      {/* Header bar */}
      <div className="flex items-center justify-between px-4 py-2.5 border-b border-border bg-surface shrink-0">
        <div className="flex items-center gap-4">
          <button
            onClick={() => router.push("/copywriting/library")}
            className="flex items-center gap-1.5 text-sm text-muted hover:text-foreground transition-colors"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
            </svg>
            Library
          </button>
          <span className="text-border">|</span>
          <h1 className="text-sm font-medium text-foreground truncate max-w-xs">
            {title || "New writeup"}
          </h1>
        </div>
        <div className="flex items-center gap-4">
          {fk.words > 0 && (
            <span className={`text-xs font-medium ${fkBadgeColor}`}>
              FK {fk.gradeLevel}
            </span>
          )}
          {overallScore !== null && (
            <ScoreRing score={overallScore} size={36} strokeWidth={3} />
          )}
          {fk.words > 0 && (
            <span className="text-xs text-muted">{fk.words} words</span>
          )}
        </div>
      </div>

      {/* Main split pane */}
      <div className="flex-1 overflow-hidden lg:grid lg:grid-cols-[1fr_400px] lg:gap-0">
        {/* Left: Editor */}
        <div className="p-4 overflow-y-auto border-r border-border">
          <EditorPanel
            title={title}
            onTitleChange={setTitle}
            content={content}
            onContentChange={setContent}
            fk={fk}
            saveStatus={saveStatus}
            onSave={saveDraft}
            textareaRef={textareaRef}
          />
        </div>

        {/* Right: Tools panel */}
        <div className="flex flex-col overflow-hidden bg-surface/50">
          {/* Tabs */}
          <div className="flex border-b border-border shrink-0">
            {TABS.map((tab) => (
              <button
                key={tab}
                onClick={() => setActiveTab(tab)}
                className={`flex-1 px-4 py-2.5 text-sm font-medium transition-colors ${
                  activeTab === tab
                    ? "text-accent border-b-2 border-accent"
                    : "text-muted hover:text-foreground"
                }`}
              >
                {tab}
              </button>
            ))}
          </div>

          {/* Tab content */}
          <div className="flex-1 overflow-y-auto p-4">
            {activeTab === "Research" && (
              <ResearchPanel
                wineDetails={wineDetails}
                onWineDetailsChange={setWineDetails}
                onInsertContent={handleInsertContent}
                title={title}
              />
            )}

            {activeTab === "Review" && (
              <ReviewPanel
                critiqueData={critiqueData}
                critiqueLoading={critiqueLoading}
                itemStatuses={itemStatuses}
                onRunReview={runReview}
                onApplyFix={applyFix}
                onDismissItem={dismissItem}
                onClickItem={clickItem}
              />
            )}

            {activeTab === "Publish" && (
              <PublishPanel
                status={writeupStatus}
                score={overallScore}
                lastSaved={lastSavedAt}
                content={content}
                onPublish={handlePublish}
                onUnpublish={handleUnpublish}
                publishing={publishing}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function EditorPage() {
  return (
    <Suspense fallback={null}>
      <EditorPageInner />
    </Suspense>
  );
}
