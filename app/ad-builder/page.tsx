"use client";

import { useEffect, useRef, useState, useCallback, Suspense } from "react";
import { useSearchParams } from "next/navigation";
import Image from "next/image";
import { nanoid } from "nanoid";
import ReferenceAdEditor from "./components/ReferenceAdEditor";
import BriefReviewStep from "./components/BriefReviewStep";
import { AD_TYPE_CONFIG } from "@/lib/ad-builder";
import type { AdType } from "@/lib/ad-builder";
import type { FilledBrief } from "@/lib/assembler";

// ── Types ──

type WineSale = {
  id: number;
  price: { value: string; cents: number };
  retail: { value: string; cents: number };
  codename: string;
  brief: string;
  mini_brief: string;
  award_name: string;
  qty_remaining: number;
  "sold_out?": boolean;
  composite_bottle_image_urls: {
    url: string;
    large_3x?: { url: string };
    small?: { url: string };
  };
  bottle_image_urls: {
    url: string;
    large_3x?: { url: string };
    small?: { url: string };
  };
  channel: { name: string; key: string };
  product: {
    id: number;
    name: string;
    vintage: string;
    abv: number;
    vineyard: string | null;
    stats: string;
    producers_description: string;
    region: { display_name: string };
    varietal: { name: string; classification: { name: string } };
    producer: { name: string };
    form_factor: { name: string; volume: number };
  };
};

type GeneratedAdResult = {
  id: string;
  wineName: string;
  saleId: number;
  mode: "basic" | "templated";
  copyVariation: {
    primaryText: string;
    headline: string;
    description: string;
  };
  imageBase64: string;
  imageMimeType: string;
  destinationUrl: string;
  referenceId?: string;
  selected: boolean;
};

type ReferenceAdMeta = {
  id: string;
  label: string;
  imageFile?: string;
  type?: string;
};

type AspectRatio = "1:1" | "4:5" | "9:16" | "16:9";

type AdSetOption = {
  id: string;
  name: string;
  status: string;
  effective_status: string;
};

type PublishResult = {
  adId: string;
  wineName: string;
  status: "success" | "error";
  metaAdId?: string;
  error?: string;
};

type ChatMessage = {
  id: string;
  role: "user" | "assistant";
  content: string;
};

// ── Helpers ──

function discount(retail: number, sale: number): number {
  if (!retail || retail <= sale) return 0;
  return Math.round(((retail - sale) / retail) * 100);
}

function fmt$(cents: number): string {
  return "$" + (cents / 100).toFixed(0);
}

function bottleImg(sale: WineSale): string {
  return (
    sale.composite_bottle_image_urls?.large_3x?.url ??
    sale.composite_bottle_image_urls?.url ??
    sale.bottle_image_urls?.large_3x?.url ??
    sale.bottle_image_urls?.url ??
    ""
  );
}

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]*>/g, "")
    .replace(/\*\*(.+?)\*\*/g, "$1")
    .replace(/\*(.+?)\*/g, "$1")
    .replace(/\r?\n/g, " ")
    .trim();
}

function wineToDetails(wine: WineSale) {
  return {
    headline: `${wine.product.producer.name} ${wine.product.name}`,
    retailPrice: "$" + parseFloat(wine.retail.value).toFixed(0),
    salePrice: "$" + parseFloat(wine.price.value).toFixed(0),
    pullQuote: stripHtml(wine.mini_brief).slice(0, 200),
    productName: `${wine.product.vintage} ${wine.product.producer.name} ${wine.product.name}`,
    ctaText: "Shop Now",
    additionalNotes: [
      wine.product.varietal.name,
      wine.product.region.display_name,
      wine.product.abv ? `${wine.product.abv}% ABV` : "",
      wine.product.vineyard ? `Vineyard: ${wine.product.vineyard}` : "",
    ]
      .filter(Boolean)
      .join(" · "),
  };
}

function getErrorHint(error: string): string | null {
  if (/permission/i.test(error))
    return "Check that META_ACCESS_TOKEN has ads_management permission and access to the page.";
  if (/invalid parameter/i.test(error))
    return "Verify ad set ID exists and belongs to this account.";
  if (/rate limit/i.test(error))
    return "Too many requests — wait a few minutes and try again.";
  return null;
}

// ── Step Indicator ──

const PDP_STEPS = [
  { num: 0, label: "Ad Type" },
  { num: 1, label: "Select Wines" },
  { num: 2, label: "Templates" },
  { num: 3, label: "Review & Edit" },
  { num: 4, label: "Publish" },
];

const OTHER_STEPS = [
  { num: 0, label: "Ad Type" },
  { num: 1, label: "Templates" },
  { num: 2, label: "Configure" },
  { num: 3, label: "Review & Edit" },
  { num: 4, label: "Publish" },
];

function BuilderStepIndicator({
  currentStep,
  onStepClick,
  maxReached,
  steps,
}: {
  currentStep: number;
  onStepClick: (step: number) => void;
  maxReached: number;
  steps: { num: number; label: string }[];
}) {
  return (
    <div className="flex gap-1 mb-6 overflow-x-auto">
      {steps.map((s) => {
        const isActive = currentStep === s.num;
        const canNavigate = s.num <= maxReached;
        return (
          <button
            key={s.num}
            type="button"
            onClick={() => canNavigate && onStepClick(s.num)}
            disabled={!canNavigate}
            className={`px-4 py-2 text-sm rounded-lg whitespace-nowrap transition-colors ${
              isActive
                ? "bg-accent text-white font-medium"
                : canNavigate
                  ? "bg-surface border border-border text-foreground hover:bg-background"
                  : "bg-surface/50 border border-border/50 text-muted cursor-not-allowed"
            }`}
          >
            {s.num + 1}. {s.label}
          </button>
        );
      })}
    </div>
  );
}

// ── Main Content ──

function AdBuilderContent() {
  const searchParams = useSearchParams();
  const urlType = searchParams.get("type");
  const urlWines = searchParams.get("wines");

  // ── Step navigation ──
  const [step, setStep] = useState(urlType === "pdp" ? 1 : 0);
  const [maxReached, setMaxReached] = useState(urlType === "pdp" ? 1 : 0);
  const [builderMode, setBuilderMode] = useState<"pdp" | "other">(
    urlType === "pdp" ? "pdp" : "pdp",
  );
  const [selectedAdType, setSelectedAdType] = useState<AdType | null>(null);
  const [typeFilter, setTypeFilter] = useState<string>("all");

  const currentSteps = builderMode === "other" ? OTHER_STEPS : PDP_STEPS;

  const goToStep = useCallback((s: number) => {
    setStep(s);
    setMaxReached((prev) => Math.max(prev, s));
  }, []);

  // ── Step 1: Wine picker ──
  const [wines, setWines] = useState<WineSale[]>([]);
  const [winesLoading, setWinesLoading] = useState(true);
  const [winesError, setWinesError] = useState<string | null>(null);
  const [selectedWineIds, setSelectedWineIds] = useState<Set<number>>(
    new Set(),
  );
  const [wineSearch, setWineSearch] = useState("");
  const [channelFilter, setChannelFilter] = useState("");

  // ── Step 2: Template config ──
  const [mode, setMode] = useState<"basic" | "templated">("basic");
  const [referenceAds, setReferenceAds] = useState<ReferenceAdMeta[]>([]);
  const [selectedRefIds, setSelectedRefIds] = useState<string[]>([]);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("1:1");
  const [imagePromptModifier, setImagePromptModifier] = useState("");
  const [refsLoading, setRefsLoading] = useState(false);
  const [editorOpen, setEditorOpen] = useState(false);
  const [editorMode, setEditorMode] = useState<"create" | "edit">("create");
  const [editorRefAd, setEditorRefAd] = useState<ReferenceAdMeta | undefined>();

  // ── HTML template brief review (two-layer system) ──
  const [htmlTemplateId, setHtmlTemplateId] = useState<string | null>(null);
  const [htmlTemplates, setHtmlTemplates] = useState<{ id: string; name: string }[]>([]);
  const [htmlTemplatesLoaded, setHtmlTemplatesLoaded] = useState(false);
  const [briefData, setBriefData] = useState<FilledBrief[] | null>(null);
  const [showBriefReview, setShowBriefReview] = useState(false);
  const [assemblingBrief, setAssemblingBrief] = useState(false);

  // ── Step 3: Generation & review ──
  const [results, setResults] = useState<GeneratedAdResult[]>([]);
  const [generating, setGenerating] = useState(false);
  const [generatingIdx, setGeneratingIdx] = useState(0);
  const [totalToGenerate, setTotalToGenerate] = useState(0);
  const [showChat, setShowChat] = useState(false);
  const [lightboxImage, setLightboxImage] = useState<{ src: string; alt: string } | null>(null);
  const [savedAdIds, setSavedAdIds] = useState<Set<string>>(new Set());
  const [savingAds, setSavingAds] = useState(false);

  // ── Step 3: AI chat ──
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [chatInput, setChatInput] = useState("");
  const [chatStreaming, setChatStreaming] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  // ── Step 4: Publish ──
  const [adsets, setAdsets] = useState<AdSetOption[]>([]);
  const [adsetsLoading, setAdsetsLoading] = useState(false);
  const [selectedAdsetId, setSelectedAdsetId] = useState("");
  const [publishStatus, setPublishStatus] = useState<"ACTIVE" | "PAUSED">(
    "PAUSED",
  );
  const [publishing, setPublishing] = useState(false);
  const [publishResults, setPublishResults] = useState<PublishResult[]>([]);
  const [publishError, setPublishError] = useState<string | null>(null);

  // ── Load wines on mount ──
  useEffect(() => {
    fetch("/api/wines/current")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setWines(data);
          if (urlWines) {
            const ids = urlWines
              .split(",")
              .map(Number)
              .filter(Boolean);
            setSelectedWineIds(new Set(ids));
          }
        } else {
          setWinesError(data.error ?? "Unexpected response");
        }
      })
      .catch(() => setWinesError("Failed to load wines"))
      .finally(() => setWinesLoading(false));
  }, [urlWines]);

  // ── Load reference ads when templated mode selected ──
  useEffect(() => {
    if (mode === "templated" && referenceAds.length === 0) {
      setRefsLoading(true);
      fetch("/api/ad-reference/list?brand=winespies")
        .then((r) => r.json())
        .then((data) => {
          const ads = data.referenceAds || data;
          if (Array.isArray(ads)) setReferenceAds(ads);
        })
        .catch(() => {})
        .finally(() => setRefsLoading(false));
    }
  }, [mode, referenceAds.length]);

  // ── Load HTML ad templates ──
  useEffect(() => {
    if (!htmlTemplatesLoaded) {
      fetch("/api/ad-builder/templates")
        .then((r) => r.json())
        .then((data) => {
          if (Array.isArray(data.templates)) setHtmlTemplates(data.templates);
        })
        .catch(() => {})
        .finally(() => setHtmlTemplatesLoaded(true));
    }
  }, [htmlTemplatesLoaded]);

  // ── Assemble brief for HTML template path ──
  const handleAssembleBrief = async () => {
    if (!htmlTemplateId || selectedWineIds.size === 0) return;
    setAssemblingBrief(true);
    try {
      const res = await fetch("/api/ad-builder/assemble-brief", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: "winespies",
          templateId: htmlTemplateId,
          wines: Array.from(selectedWineIds).map((id) => ({ saleId: id })),
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || "Failed to assemble brief");
      setBriefData(data.briefs);
      setShowBriefReview(true);
    } catch (err) {
      alert(err instanceof Error ? err.message : "Failed to assemble brief");
    } finally {
      setAssemblingBrief(false);
    }
  };

  const handleBriefApproved = async (approvedBriefs: FilledBrief[]) => {
    setBriefData(approvedBriefs);
    setGenerating(true);
    setResults([]);
    goToStep(3);
    setShowBriefReview(false);

    setTotalToGenerate(approvedBriefs.length);
    const generated: GeneratedAdResult[] = [];

    for (let i = 0; i < approvedBriefs.length; i++) {
      setGeneratingIdx(i + 1);
      const brief = approvedBriefs[i];
      const wine = wines.find(
        (w) => w.codename === brief.productId || `wine-${w.id}` === brief.productId,
      );
      const wineName = wine
        ? `${wine.product.vintage} ${wine.product.producer.name} ${wine.product.name}`
        : brief.productId;

      try {
        const res = await fetch("/api/ad-builder/generate-html-ad", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            templateId: brief.templateId,
            brief,
          }),
        });
        const data = await res.json();

        if (!res.ok) {
          generated.push({
            id: nanoid(),
            wineName,
            saleId: wine?.id ?? 0,
            mode: "templated",
            copyVariation: {
              primaryText: brief.slots.find((s) => s.key === "body")?.value ?? "",
              headline: brief.slots.find((s) => s.key === "headline")?.value ?? "",
              description: "",
            },
            imageBase64: "",
            imageMimeType: "",
            destinationUrl: wine ? `https://winespies.com/sales/${wine.id}` : "https://winespies.com",
            selected: false,
          });
          continue;
        }

        generated.push({
          id: nanoid(),
          wineName,
          saleId: wine?.id ?? 0,
          mode: "templated",
          copyVariation: {
            primaryText: brief.slots.find((s) => s.key === "body")?.value ?? "",
            headline: brief.slots.find((s) => s.key === "headline")?.value ?? "",
            description: "",
          },
          imageBase64: data.imageBase64,
          imageMimeType: data.mimeType || "image/png",
          destinationUrl: wine ? `https://winespies.com/sales/${wine.id}` : "https://winespies.com",
          selected: true,
        });
      } catch (err) {
        generated.push({
          id: nanoid(),
          wineName,
          saleId: wine?.id ?? 0,
          mode: "templated",
          copyVariation: { primaryText: "", headline: err instanceof Error ? err.message : "Generation failed", description: "" },
          imageBase64: "",
          imageMimeType: "",
          destinationUrl: wine ? `https://winespies.com/sales/${wine.id}` : "https://winespies.com",
          selected: false,
        });
      }
    }

    setResults(generated);
    setGenerating(false);
  };

  // ── Load ad sets when entering publish step ──
  useEffect(() => {
    if (step === 4 && adsets.length === 0) {
      setAdsetsLoading(true);
      fetch("/api/meta-ads/adsets-live?brand=winespies")
        .then((r) => r.json())
        .then((data) => {
          if (data.adsets) {
            setAdsets(data.adsets);
            const active = data.adsets.find(
              (a: AdSetOption) => a.effective_status === "ACTIVE",
            );
            if (active) setSelectedAdsetId(active.id);
          }
        })
        .catch(() => {})
        .finally(() => setAdsetsLoading(false));
    }
  }, [step, adsets.length]);

  // ── Scroll chat ──
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  // ── Wine picker helpers ──
  const channels = Array.from(
    new Set(wines.map((w) => w.channel.name)),
  ).sort();

  const filteredWines = wines.filter((w) => {
    if (w["sold_out?"]) return false;
    if (channelFilter && w.channel.name !== channelFilter) return false;
    if (wineSearch.trim()) {
      const q = wineSearch.toLowerCase();
      const hay = [
        w.product.name,
        w.product.producer.name,
        w.product.varietal.name,
        w.product.region.display_name,
        w.codename,
      ]
        .join(" ")
        .toLowerCase();
      if (!hay.includes(q)) return false;
    }
    return true;
  });

  const toggleWine = (id: number) => {
    setSelectedWineIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllWines = () =>
    setSelectedWineIds(new Set(filteredWines.map((w) => w.id)));
  const clearWineSelection = () => setSelectedWineIds(new Set());

  // ── Template helpers ──
  const toggleRef = (id: string) => {
    setSelectedRefIds((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id],
    );
  };

  const refreshReferenceAds = useCallback(() => {
    setRefsLoading(true);
    fetch("/api/ad-reference/list?brand=winespies")
      .then((r) => r.json())
      .then((data) => {
        const ads = data.referenceAds || data;
        if (Array.isArray(ads)) setReferenceAds(ads);
      })
      .catch(() => {})
      .finally(() => setRefsLoading(false));
  }, []);

  const selectedWines = wines.filter((w) => selectedWineIds.has(w.id));
  const totalAds =
    mode === "basic"
      ? selectedWines.length
      : builderMode === "other" && selectedAdType === "lifestyle"
        ? selectedRefIds.length
        : selectedWines.length * Math.max(selectedRefIds.length, 1);
  const canGenerate =
    builderMode === "other"
      ? selectedRefIds.length > 0 &&
        (selectedAdType === "lifestyle" || selectedWines.length > 0)
      : selectedWines.length > 0 &&
        (mode === "basic" || selectedRefIds.length > 0);

  // ── Generation ──
  const handleGenerate = async () => {
    if (!canGenerate) return;
    setGenerating(true);
    setResults([]);
    goToStep(3);

    type Task = { wine?: WineSale; referenceId?: string };
    const tasks: Task[] = [];

    if (builderMode === "other" && selectedAdType === "lifestyle") {
      // Lifestyle: no wines, just templates
      for (const refId of selectedRefIds) {
        tasks.push({ referenceId: refId });
      }
    } else if (mode === "basic") {
      for (const wine of selectedWines) {
        tasks.push({ wine });
      }
    } else {
      for (const wine of selectedWines) {
        for (const refId of selectedRefIds) {
          tasks.push({ wine, referenceId: refId });
        }
      }
    }

    setTotalToGenerate(tasks.length);
    const generated: GeneratedAdResult[] = [];

    for (let i = 0; i < tasks.length; i++) {
      setGeneratingIdx(i + 1);
      const task = tasks[i];
      const details = task.wine ? wineToDetails(task.wine) : { headline: "Brand Ad", ctaText: "Discover" };
      const wineName = task.wine
        ? `${task.wine.product.vintage} ${task.wine.product.producer.name} ${task.wine.product.name}`
        : "Brand / Lifestyle Ad";

      const genMode = builderMode === "other" ? "templated" : mode;
      try {
        const res = await fetch("/api/wines/generate-single", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            brand: "winespies",
            mode: genMode,
            wineDetails: details,
            bottleImageUrl: task.wine ? bottleImg(task.wine) : undefined,
            saleId: task.wine?.id ?? 0,
            wineName,
            referenceId: task.referenceId,
            aspectRatio,
            imagePromptModifier,
            adType: builderMode === "other" ? selectedAdType : undefined,
          }),
        });

        const data = await res.json();

        if (!res.ok) {
          generated.push({
            id: nanoid(),
            wineName,
            saleId: task.wine?.id ?? 0,
            mode: genMode,
            copyVariation: {
              primaryText: "",
              headline: data.error ?? "Generation failed",
              description: "",
            },
            imageBase64: "",
            imageMimeType: "",
            destinationUrl: task.wine ? `https://winespies.com/sales/${task.wine.id}` : "https://winespies.com",
            referenceId: task.referenceId,
            selected: false,
          });
          continue;
        }

        generated.push({
          id: nanoid(),
          wineName: data.wineName,
          saleId: data.saleId,
          mode: data.mode,
          copyVariation: data.copyVariation,
          imageBase64: data.imageBase64,
          imageMimeType: data.imageMimeType,
          destinationUrl: data.destinationUrl,
          referenceId: task.referenceId,
          selected: true,
        });
      } catch (err) {
        generated.push({
          id: nanoid(),
          wineName,
          saleId: task.wine?.id ?? 0,
          mode: genMode,
          copyVariation: {
            primaryText: "",
            headline:
              err instanceof Error ? err.message : "Network error",
            description: "",
          },
          imageBase64: "",
          imageMimeType: "",
          destinationUrl: task.wine ? `https://winespies.com/sales/${task.wine.id}` : "https://winespies.com",
          referenceId: task.referenceId,
          selected: false,
        });
      }
    }

    setResults(generated);
    setGenerating(false);
  };

  // ── Review helpers ──
  const handleUpdateResult = (
    id: string,
    updates: Partial<GeneratedAdResult>,
  ) => {
    setResults((prev) =>
      prev.map((r) => (r.id === id ? { ...r, ...updates } : r)),
    );
  };

  const handleToggleSelect = (id: string) => {
    setResults((prev) =>
      prev.map((r) =>
        r.id === id ? { ...r, selected: !r.selected } : r,
      ),
    );
  };

  const handleToggleAll = (selected: boolean) => {
    setResults((prev) =>
      prev.map((r) => (r.imageBase64 ? { ...r, selected } : r)),
    );
  };

  const selectedAds = results.filter((r) => r.selected && r.imageBase64);
  const validResults = results.filter((r) => r.imageBase64);

  const handleSaveAds = async (adsToSave: GeneratedAdResult[]) => {
    if (adsToSave.length === 0) return;
    setSavingAds(true);
    try {
      const payload = adsToSave.map((ad) => ({
        id: ad.id,
        wineName: ad.wineName,
        saleId: ad.saleId,
        templateId: ad.referenceId || "",
        headline: ad.copyVariation.headline,
        primaryText: ad.copyVariation.primaryText,
        description: ad.copyVariation.description,
        destinationUrl: ad.destinationUrl,
        imageBase64: ad.imageBase64,
        imageMimeType: ad.imageMimeType,
        savedAt: new Date().toISOString(),
      }));
      const res = await fetch("/api/ad-builder/saved-ads", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ads: payload }),
      });
      if (res.ok) {
        setSavedAdIds((prev) => {
          const next = new Set(prev);
          adsToSave.forEach((ad) => next.add(ad.id));
          return next;
        });
      }
    } catch {
      // silent fail — user sees no checkmark
    } finally {
      setSavingAds(false);
    }
  };

  // ── AI Chat ──
  const sendChat = async () => {
    const text = chatInput.trim();
    if (!text || chatStreaming) return;

    const userMsg: ChatMessage = {
      id: nanoid(),
      role: "user",
      content: text,
    };
    const assistantMsg: ChatMessage = {
      id: nanoid(),
      role: "assistant",
      content: "",
    };

    setChatMessages((prev) => [...prev, userMsg, assistantMsg]);
    setChatInput("");
    setChatStreaming(true);

    try {
      const focusedAd = selectedAds[0];
      const adContext = focusedAd
        ? {
            headline: focusedAd.copyVariation.headline,
            primaryText: focusedAd.copyVariation.primaryText,
            description: focusedAd.copyVariation.description,
            destinationUrl: focusedAd.destinationUrl,
          }
        : undefined;

      const allMessages = [...chatMessages, userMsg].map((m) => ({
        role: m.role,
        content: m.content,
      }));

      const res = await fetch("/api/workshop/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: "winespies",
          messages: allMessages,
          adContext,
        }),
      });

      if (!res.ok || !res.body) {
        setChatMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: "Failed to get response" }
              : m,
          ),
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
        setChatMessages((prev) =>
          prev.map((m) =>
            m.id === assistantMsg.id
              ? { ...m, content: captured }
              : m,
          ),
        );
      }
    } catch {
      setChatMessages((prev) =>
        prev.map((m) =>
          m.id === assistantMsg.id
            ? { ...m, content: "Error: request failed" }
            : m,
        ),
      );
    } finally {
      setChatStreaming(false);
    }
  };

  // ── Publish ──
  const handlePublish = async () => {
    if (!selectedAdsetId || selectedAds.length === 0) return;
    setPublishing(true);
    setPublishResults([]);
    setPublishError(null);

    try {
      const res = await fetch("/api/wines/publish-to-meta", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          brand: "winespies",
          adsetId: selectedAdsetId,
          status: publishStatus,
          ads: selectedAds.map((ad) => ({
            id: ad.id,
            wineName: ad.wineName,
            saleId: ad.saleId,
            imageBase64: ad.imageBase64,
            copyVariation: ad.copyVariation,
            destinationUrl: ad.destinationUrl,
          })),
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setPublishError(data.error ?? "Publish failed");
        return;
      }

      setPublishResults(data.results ?? []);
    } catch (err) {
      setPublishError(
        err instanceof Error ? err.message : "Publish failed",
      );
    } finally {
      setPublishing(false);
    }
  };

  const publishSuccessCount = publishResults.filter(
    (r) => r.status === "success",
  ).length;
  const publishFailCount = publishResults.filter(
    (r) => r.status === "error",
  ).length;
  const isDone = publishResults.length > 0;

  // ── Render ──
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight mb-1">
        Ad Builder
      </h1>
      <p className="text-muted mb-4">
        Build, review, and publish ads for your wine products.
      </p>

      <BuilderStepIndicator
        currentStep={step}
        onStepClick={goToStep}
        maxReached={maxReached}
        steps={currentSteps}
      />

      <div className="rounded-xl border border-border bg-surface">
        {/* ══════ Step 0: Ad Type ══════ */}
        {step === 0 && (
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-1">Choose Ad Type</h2>
            <p className="text-sm text-muted mb-6">
              What kind of ad do you want to build?
            </p>

            <div className="grid gap-4 sm:grid-cols-2 max-w-xl">
              <button
                type="button"
                onClick={() => {
                  setBuilderMode("pdp");
                  setSelectedAdType("pdp");
                  goToStep(1);
                }}
                className="text-left rounded-xl border-2 border-accent bg-accent/5 p-6 hover:bg-accent/10 transition-colors"
              >
                <h3 className="font-semibold text-accent mb-1">
                  PDP — Product Display Ad
                </h3>
                <p className="text-sm text-muted">
                  Build ads for wine products using templates and
                  AI-generated copy.
                </p>
              </button>
              <button
                type="button"
                onClick={() => {
                  setBuilderMode("other");
                  setSelectedAdType(null);
                  setMode("templated");
                  setMaxReached(0);
                  goToStep(1);
                  // Load reference ads for the template browser
                  if (referenceAds.length === 0) {
                    setRefsLoading(true);
                    fetch("/api/ad-reference/list?brand=winespies")
                      .then((r) => r.json())
                      .then((data) => {
                        const ads = data.referenceAds || data;
                        if (Array.isArray(ads)) setReferenceAds(ads);
                      })
                      .catch(() => {})
                      .finally(() => setRefsLoading(false));
                  }
                }}
                className="text-left rounded-xl border-2 border-border bg-surface p-6 hover:bg-accent/5 hover:border-accent/50 transition-colors"
              >
                <h3 className="font-semibold mb-1">
                  Other Ad Types
                </h3>
                <p className="text-sm text-muted">
                  Browse all templates — testimonial, comparison, offer,
                  UGC, lifestyle, and more.
                </p>
              </button>
            </div>
          </div>
        )}

        {/* ══════ Step 1: Template Browser (Other mode) ══════ */}
        {step === 1 && builderMode === "other" && (
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-1">Browse Templates</h2>
            <p className="text-sm text-muted mb-4">
              Select one or more reference ad templates to use.
            </p>

            {/* Type filter pills */}
            {(() => {
              const typesPresent = Array.from(new Set(referenceAds.map((a) => a.type).filter(Boolean))) as string[];
              return (
                <div className="flex gap-2 mb-4 flex-wrap">
                  <button
                    type="button"
                    onClick={() => setTypeFilter("all")}
                    className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                      typeFilter === "all"
                        ? "bg-accent text-white border-accent"
                        : "bg-background border-border hover:bg-surface"
                    }`}
                  >
                    All
                  </button>
                  {typesPresent.map((t) => {
                    const cfg = AD_TYPE_CONFIG[t as AdType];
                    return (
                      <button
                        key={t}
                        type="button"
                        onClick={() => setTypeFilter(t)}
                        className={`px-3 py-1.5 text-xs rounded-full border transition-colors ${
                          typeFilter === t
                            ? "bg-accent text-white border-accent"
                            : cfg
                              ? `${cfg.color} ${cfg.textColor}`
                              : "bg-background border-border hover:bg-surface"
                        }`}
                      >
                        {cfg?.label ?? t}
                      </button>
                    );
                  })}
                </div>
              );
            })()}

            {refsLoading ? (
              <p className="text-sm text-muted py-8 text-center">Loading templates...</p>
            ) : (() => {
              const browsable = referenceAds.filter(
                (a) => typeFilter === "all" || a.type === typeFilter,
              );
              return browsable.length === 0 ? (
                <div className="text-center py-12">
                  <p className="text-sm text-muted mb-2">
                    {referenceAds.length === 0
                      ? "No reference ad templates found."
                      : `No templates matching "${typeFilter}".`}
                  </p>
                  <p className="text-xs text-muted">
                    Create templates using the reference ad editor — they&apos;ll appear here.
                  </p>
                </div>
              ) : (
                <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                  {browsable.map((ad) => {
                    const selected = selectedRefIds.includes(ad.id);
                    const adTypeCfg = ad.type ? AD_TYPE_CONFIG[ad.type as AdType] : null;
                    return (
                      <button
                        key={ad.id}
                        type="button"
                        onClick={() => {
                          toggleRef(ad.id);
                          if (!selected && ad.type) {
                            setSelectedAdType(ad.type as AdType);
                          }
                        }}
                        className={`group relative rounded-lg border-2 overflow-hidden text-left transition-colors ${
                          selected
                            ? "border-accent ring-2 ring-accent/30"
                            : "border-border hover:border-accent/50"
                        }`}
                      >
                        <div className="aspect-square bg-background relative">
                          {ad.imageFile ? (
                            <Image
                              src={`/api/ad-reference/image?id=${ad.id}`}
                              alt={ad.label}
                              fill
                              className="object-cover"
                              sizes="200px"
                              unoptimized
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full text-muted text-xs">
                              No image
                            </div>
                          )}
                          {selected && (
                            <div className="absolute top-1 right-1 w-5 h-5 bg-accent rounded-full flex items-center justify-center">
                              <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                              </svg>
                            </div>
                          )}
                        </div>
                        <div className="p-2">
                          <div className="text-xs font-medium truncate">{ad.label}</div>
                          {adTypeCfg && (
                            <span className={`inline-block mt-0.5 text-[10px] px-1.5 py-0.5 rounded ${adTypeCfg.color} ${adTypeCfg.textColor}`}>
                              {adTypeCfg.label}
                            </span>
                          )}
                        </div>
                      </button>
                    );
                  })}
                  {/* + New Template card */}
                  <button
                    type="button"
                    onClick={() => {
                      setEditorRefAd(undefined);
                      setEditorMode("create");
                      setEditorOpen(true);
                    }}
                    className="rounded-lg border-2 border-dashed border-border hover:border-accent/50 overflow-hidden text-left transition-colors"
                  >
                    <div className="aspect-square bg-background flex flex-col items-center justify-center gap-2">
                      <svg className="w-8 h-8 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                      </svg>
                      <span className="text-xs text-muted font-medium">New Template</span>
                    </div>
                  </button>
                </div>
              );
            })()}

            {/* Footer */}
            <div className="mt-6 flex justify-between items-center">
              <button
                type="button"
                onClick={() => {
                  setBuilderMode("pdp");
                  goToStep(0);
                  setMaxReached(0);
                }}
                className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-background transition-colors"
              >
                Back
              </button>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted">
                  {selectedRefIds.length} template{selectedRefIds.length !== 1 ? "s" : ""} selected
                </span>
                <button
                  type="button"
                  disabled={selectedRefIds.length === 0}
                  onClick={() => goToStep(2)}
                  className="px-6 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════ Step 1: Select Wines (PDP mode) ══════ */}
        {step === 1 && builderMode === "pdp" && (
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-1">Select Wines</h2>
            <p className="text-sm text-muted mb-4">
              Choose which wines to build ads for.
            </p>

            <div className="flex gap-3 mb-4 flex-wrap items-center">
              <input
                type="text"
                value={wineSearch}
                onChange={(e) => setWineSearch(e.target.value)}
                placeholder="Search wines..."
                className="px-3 py-2 text-sm border border-border rounded-lg bg-background min-w-[200px]"
              />
              <select
                value={channelFilter}
                onChange={(e) => setChannelFilter(e.target.value)}
                className="px-3 py-2 text-sm border border-border rounded-lg bg-background"
              >
                <option value="">All channels</option>
                {channels.map((ch) => (
                  <option key={ch} value={ch}>
                    {ch}
                  </option>
                ))}
              </select>
              <span className="text-xs text-muted">
                {filteredWines.length} wine
                {filteredWines.length !== 1 ? "s" : ""} available
              </span>
              {filteredWines.length > 0 && (
                <button
                  type="button"
                  onClick={
                    selectedWineIds.size === filteredWines.length
                      ? clearWineSelection
                      : selectAllWines
                  }
                  className="text-xs text-accent hover:underline ml-auto"
                >
                  {selectedWineIds.size === filteredWines.length
                    ? "Deselect All"
                    : "Select All"}
                </button>
              )}
            </div>

            {winesLoading ? (
              <p className="text-sm text-muted py-8 text-center">
                Loading wines...
              </p>
            ) : winesError ? (
              <div className="text-sm text-danger bg-danger/10 rounded-lg px-4 py-3">
                {winesError}
              </div>
            ) : filteredWines.length === 0 ? (
              <p className="text-sm text-muted py-8 text-center">
                No wines match your search.
              </p>
            ) : (
              <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 max-h-[50vh] overflow-y-auto">
                {filteredWines.map((wine) => {
                  const pct = discount(
                    wine.retail.cents,
                    wine.price.cents,
                  );
                  const img = bottleImg(wine);
                  const isSelected = selectedWineIds.has(wine.id);
                  return (
                    <button
                      key={wine.id}
                      type="button"
                      onClick={() => toggleWine(wine.id)}
                      className={`text-left rounded-lg border-2 overflow-hidden transition-colors ${
                        isSelected
                          ? "border-accent ring-1 ring-accent/20"
                          : "border-border hover:border-accent/50"
                      }`}
                    >
                      <div className="relative bg-background flex items-center justify-center h-32">
                        {img ? (
                          <Image
                            src={img}
                            alt={wine.product.name}
                            fill
                            className="object-contain p-2"
                            sizes="200px"
                            unoptimized
                          />
                        ) : (
                          <span className="text-muted text-[10px]">
                            No image
                          </span>
                        )}
                        {pct > 0 && (
                          <span className="absolute top-1 right-1 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">
                            {pct}% OFF
                          </span>
                        )}
                        <span className="absolute top-1 left-1 bg-black/60 text-white text-[9px] px-1.5 py-0.5 rounded">
                          {wine.channel.name}
                        </span>
                        {isSelected && (
                          <div className="absolute bottom-1 left-1 w-5 h-5 bg-accent rounded-full flex items-center justify-center">
                            <svg
                              className="w-3 h-3 text-white"
                              fill="none"
                              viewBox="0 0 24 24"
                              stroke="currentColor"
                              strokeWidth={3}
                            >
                              <path
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                d="M5 13l4 4L19 7"
                              />
                            </svg>
                          </div>
                        )}
                      </div>
                      <div className="p-2">
                        <div className="text-[10px] text-muted">
                          {wine.product.producer.name} ·{" "}
                          {wine.product.vintage}
                        </div>
                        <div className="text-xs font-medium leading-tight truncate">
                          {wine.product.name}
                        </div>
                        <div className="text-xs mt-0.5">
                          <span className="font-semibold text-accent">
                            {fmt$(wine.price.cents)}
                          </span>
                          {wine.retail.cents > wine.price.cents && (
                            <span className="text-muted line-through ml-1 text-[10px]">
                              {fmt$(wine.retail.cents)}
                            </span>
                          )}
                        </div>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}

            {/* Footer */}
            <div className="mt-6 flex justify-between items-center">
              <button
                type="button"
                onClick={() => goToStep(0)}
                className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-background transition-colors"
              >
                Back
              </button>
              <div className="flex items-center gap-3">
                <span className="text-sm text-muted">
                  {selectedWineIds.size} wine
                  {selectedWineIds.size !== 1 ? "s" : ""} selected
                </span>
                <button
                  type="button"
                  disabled={selectedWineIds.size === 0}
                  onClick={() => goToStep(2)}
                  className="px-6 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  Next
                </button>
              </div>
            </div>
          </div>
        )}

        {/* ══════ Step 2: Configure (Other mode) ══════ */}
        {step === 2 && builderMode === "other" && (
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-1">Configure</h2>
            <p className="text-sm text-muted mb-4">
              Provide details for your{" "}
              {selectedAdType ? AD_TYPE_CONFIG[selectedAdType]?.label ?? selectedAdType : "ad"}.
            </p>

            {/* Show type badge */}
            {selectedAdType && AD_TYPE_CONFIG[selectedAdType] && (
              <div className="mb-4">
                <span className={`inline-block text-xs px-2 py-1 rounded ${AD_TYPE_CONFIG[selectedAdType].color} ${AD_TYPE_CONFIG[selectedAdType].textColor}`}>
                  {AD_TYPE_CONFIG[selectedAdType].label}
                </span>
              </div>
            )}

            {/* Wine picker for wine-related types */}
            {selectedAdType !== "lifestyle" && (
              <div className="mb-6">
                <label className="text-sm font-medium mb-2 block">Select Wines</label>
                <p className="text-xs text-muted mb-3">Choose which wines to build ads for.</p>

                <div className="flex gap-3 mb-3 flex-wrap items-center">
                  <input
                    type="text"
                    value={wineSearch}
                    onChange={(e) => setWineSearch(e.target.value)}
                    placeholder="Search wines..."
                    className="px-3 py-2 text-sm border border-border rounded-lg bg-background min-w-[200px]"
                  />
                  <select
                    value={channelFilter}
                    onChange={(e) => setChannelFilter(e.target.value)}
                    className="px-3 py-2 text-sm border border-border rounded-lg bg-background"
                  >
                    <option value="">All channels</option>
                    {channels.map((ch) => (
                      <option key={ch} value={ch}>{ch}</option>
                    ))}
                  </select>
                  <span className="text-xs text-muted">
                    {filteredWines.length} wine{filteredWines.length !== 1 ? "s" : ""} available
                  </span>
                  {filteredWines.length > 0 && (
                    <button
                      type="button"
                      onClick={selectedWineIds.size === filteredWines.length ? clearWineSelection : selectAllWines}
                      className="text-xs text-accent hover:underline ml-auto"
                    >
                      {selectedWineIds.size === filteredWines.length ? "Deselect All" : "Select All"}
                    </button>
                  )}
                </div>

                {winesLoading ? (
                  <p className="text-sm text-muted py-4 text-center">Loading wines...</p>
                ) : filteredWines.length === 0 ? (
                  <p className="text-sm text-muted py-4 text-center">No wines match your search.</p>
                ) : (
                  <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 max-h-[30vh] overflow-y-auto">
                    {filteredWines.map((wine) => {
                      const pct = discount(wine.retail.cents, wine.price.cents);
                      const img = bottleImg(wine);
                      const isSelected = selectedWineIds.has(wine.id);
                      return (
                        <button
                          key={wine.id}
                          type="button"
                          onClick={() => toggleWine(wine.id)}
                          className={`text-left rounded-lg border-2 overflow-hidden transition-colors ${
                            isSelected
                              ? "border-accent ring-1 ring-accent/20"
                              : "border-border hover:border-accent/50"
                          }`}
                        >
                          <div className="relative bg-background flex items-center justify-center h-24">
                            {img ? (
                              <Image src={img} alt={wine.product.name} fill className="object-contain p-2" sizes="150px" unoptimized />
                            ) : (
                              <span className="text-muted text-[10px]">No image</span>
                            )}
                            {pct > 0 && (
                              <span className="absolute top-1 right-1 bg-red-600 text-white text-[9px] font-bold px-1.5 py-0.5 rounded">{pct}% OFF</span>
                            )}
                            {isSelected && (
                              <div className="absolute bottom-1 left-1 w-5 h-5 bg-accent rounded-full flex items-center justify-center">
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                </svg>
                              </div>
                            )}
                          </div>
                          <div className="p-2">
                            <div className="text-[10px] text-muted">{wine.product.producer.name} · {wine.product.vintage}</div>
                            <div className="text-xs font-medium leading-tight truncate">{wine.product.name}</div>
                            <div className="text-xs mt-0.5">
                              <span className="font-semibold text-accent">{fmt$(wine.price.cents)}</span>
                              {wine.retail.cents > wine.price.cents && (
                                <span className="text-muted line-through ml-1 text-[10px]">{fmt$(wine.retail.cents)}</span>
                              )}
                            </div>
                          </div>
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            )}

            {/* Lifestyle-specific fields */}
            {selectedAdType === "lifestyle" && (
              <div className="mb-6 space-y-4">
                <div>
                  <label className="text-sm font-medium mb-1 block">Headline</label>
                  <input
                    type="text"
                    value={wineSearch}
                    onChange={() => {}}
                    placeholder="Brand headline or hook..."
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
                  />
                </div>
                <div>
                  <label className="text-sm font-medium mb-1 block">Brief Description</label>
                  <textarea
                    rows={3}
                    placeholder="Describe the ad concept, mood, or brief..."
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background resize-none"
                  />
                </div>
              </div>
            )}

            {/* Aspect ratio */}
            <div className="mb-6">
              <label className="text-sm font-medium mb-2 block">Aspect Ratio</label>
              <div className="flex gap-2">
                {(["1:1", "4:5", "9:16", "16:9"] as AspectRatio[]).map((ar) => (
                  <button
                    key={ar}
                    type="button"
                    onClick={() => setAspectRatio(ar)}
                    className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                      aspectRatio === ar
                        ? "bg-accent text-white border-accent"
                        : "bg-background border-border hover:bg-surface"
                    }`}
                  >
                    {ar}
                  </button>
                ))}
              </div>
            </div>

            {/* Image prompt modifier */}
            <div className="mb-6">
              <label className="text-sm font-medium mb-1 block">
                Image Prompt Modifier <span className="text-muted font-normal">(optional)</span>
              </label>
              <textarea
                value={imagePromptModifier}
                onChange={(e) => setImagePromptModifier(e.target.value)}
                rows={3}
                placeholder="Additional visual instructions for image generation..."
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background resize-none"
              />
            </div>

            {/* Summary */}
            <div className="bg-background border border-border rounded-lg p-4 mb-6">
              <div className="text-sm font-medium text-accent">
                {selectedAdType === "lifestyle" ? (
                  <>{selectedRefIds.length} template{selectedRefIds.length !== 1 ? "s" : ""} selected</>
                ) : (
                  <>
                    {selectedWineIds.size} wine{selectedWineIds.size !== 1 ? "s" : ""} × {selectedRefIds.length} template{selectedRefIds.length !== 1 ? "s" : ""} ={" "}
                    {selectedWineIds.size * selectedRefIds.length} ad{selectedWineIds.size * selectedRefIds.length !== 1 ? "s" : ""}
                  </>
                )}
              </div>
            </div>

            {/* Footer */}
            <div className="flex justify-between items-center">
              <button
                type="button"
                onClick={() => goToStep(1)}
                className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-background transition-colors"
              >
                Back
              </button>
              <button
                type="button"
                disabled={
                  selectedRefIds.length === 0 ||
                  (selectedAdType !== "lifestyle" && selectedWineIds.size === 0)
                }
                onClick={handleGenerate}
                className="px-6 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Generate{" "}
                {selectedAdType === "lifestyle"
                  ? `${selectedRefIds.length} Ad${selectedRefIds.length !== 1 ? "s" : ""}`
                  : `${selectedWineIds.size * selectedRefIds.length} Ad${selectedWineIds.size * selectedRefIds.length !== 1 ? "s" : ""}`}
              </button>
            </div>
          </div>
        )}

        {/* ══════ Step 2: Templates (PDP mode) ══════ */}
        {step === 2 && builderMode === "pdp" && (
          <div className="p-6">
            <h2 className="text-lg font-semibold mb-1">
              Choose Templates
            </h2>
            <p className="text-sm text-muted mb-4">
              Configure how your ads will be generated.
            </p>

            {/* Mode toggle */}
            <div className="mb-6">
              <label className="text-sm font-medium mb-2 block">
                Generation Mode
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setMode("basic")}
                  className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                    mode === "basic"
                      ? "bg-accent text-white border-accent"
                      : "bg-background border-border hover:bg-surface"
                  }`}
                >
                  Basic
                </button>
                <button
                  type="button"
                  onClick={() => setMode("templated")}
                  className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                    mode === "templated"
                      ? "bg-accent text-white border-accent"
                      : "bg-background border-border hover:bg-surface"
                  }`}
                >
                  Templated
                </button>
              </div>
            </div>

            {mode === "basic" ? (
              <div className="bg-background border border-border rounded-lg p-4 mb-6">
                <h3 className="text-sm font-semibold mb-1">Basic Mode</h3>
                <p className="text-xs text-muted">
                  Uses each wine&apos;s bottle photo as the ad image.
                  Generates ad copy via Claude. Fast — no image
                  generation needed.
                </p>
                <div className="mt-3 text-sm font-medium text-accent">
                  {selectedWines.length} wine
                  {selectedWines.length !== 1 ? "s" : ""} →{" "}
                  {selectedWines.length} ad
                  {selectedWines.length !== 1 ? "s" : ""} (bottle photo +
                  generated copy)
                </div>
              </div>
            ) : (
              <>
                <div className="bg-background border border-border rounded-lg p-4 mb-6">
                  <h3 className="text-sm font-semibold mb-1">
                    Templated Mode
                  </h3>
                  <p className="text-xs text-muted">
                    Select reference ad template(s). Each wine gets a
                    styled ad image generated via Gemini for every
                    selected template.
                  </p>
                  <div className="mt-3 text-sm font-medium text-accent">
                    {selectedWines.length} wine
                    {selectedWines.length !== 1 ? "s" : ""} ×{" "}
                    {selectedRefIds.length} template
                    {selectedRefIds.length !== 1 ? "s" : ""} = {totalAds}{" "}
                    ad
                    {totalAds !== 1 ? "s" : ""}
                  </div>
                </div>

                {/* Reference ad grid */}
                <div className="mb-6">
                  <label className="text-sm font-medium mb-2 block">
                    Select Template(s)
                  </label>
                  {refsLoading ? (
                    <p className="text-sm text-muted">
                      Loading templates...
                    </p>
                  ) : (
                    <div className="grid grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-3">
                      {referenceAds.map((ad) => {
                        const selected = selectedRefIds.includes(ad.id);
                        return (
                          <button
                            key={ad.id}
                            type="button"
                            onClick={() => toggleRef(ad.id)}
                            className={`group relative rounded-lg border-2 overflow-hidden text-left transition-colors ${
                              selected
                                ? "border-accent ring-2 ring-accent/30"
                                : "border-border hover:border-accent/50"
                            }`}
                          >
                            <div className="aspect-square bg-background relative">
                              {ad.imageFile ? (
                                <Image
                                  src={`/api/ad-reference/image?id=${ad.id}`}
                                  alt={ad.label}
                                  fill
                                  className="object-cover"
                                  sizes="200px"
                                  unoptimized
                                />
                              ) : (
                                <div className="flex items-center justify-center h-full text-muted text-xs">
                                  No image
                                </div>
                              )}
                              {/* Edit icon — visible on hover */}
                              <div
                                onClick={(e) => {
                                  e.stopPropagation();
                                  setEditorRefAd(ad);
                                  setEditorMode("edit");
                                  setEditorOpen(true);
                                }}
                                className="absolute top-1 left-1 w-6 h-6 bg-black/60 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer hover:bg-black/80"
                              >
                                <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
                                </svg>
                              </div>
                              {selected && (
                                <div className="absolute top-1 right-1 w-5 h-5 bg-accent rounded-full flex items-center justify-center">
                                  <svg
                                    className="w-3 h-3 text-white"
                                    fill="none"
                                    viewBox="0 0 24 24"
                                    stroke="currentColor"
                                    strokeWidth={3}
                                  >
                                    <path
                                      strokeLinecap="round"
                                      strokeLinejoin="round"
                                      d="M5 13l4 4L19 7"
                                    />
                                  </svg>
                                </div>
                              )}
                            </div>
                            <div className="p-2">
                              <div className="text-xs font-medium truncate">
                                {ad.label}
                              </div>
                              {ad.type && (
                                <div className="text-[10px] text-muted mt-0.5">
                                  {ad.type}
                                </div>
                              )}
                            </div>
                          </button>
                        );
                      })}
                      {/* + New Template card */}
                      <button
                        type="button"
                        onClick={() => {
                          setEditorRefAd(undefined);
                          setEditorMode("create");
                          setEditorOpen(true);
                        }}
                        className="rounded-lg border-2 border-dashed border-border hover:border-accent/50 overflow-hidden text-left transition-colors"
                      >
                        <div className="aspect-square bg-background flex flex-col items-center justify-center gap-2">
                          <svg className="w-8 h-8 text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M12 4.5v15m7.5-7.5h-15" />
                          </svg>
                          <span className="text-xs text-muted font-medium">New Template</span>
                        </div>
                      </button>
                    </div>
                  )}
                </div>

                {/* Aspect ratio */}
                <div className="mb-6">
                  <label className="text-sm font-medium mb-2 block">
                    Aspect Ratio
                  </label>
                  <div className="flex gap-2">
                    {(
                      ["1:1", "4:5", "9:16", "16:9"] as AspectRatio[]
                    ).map((ar) => (
                      <button
                        key={ar}
                        type="button"
                        onClick={() => setAspectRatio(ar)}
                        className={`px-3 py-1.5 text-xs rounded-lg border transition-colors ${
                          aspectRatio === ar
                            ? "bg-accent text-white border-accent"
                            : "bg-background border-border hover:bg-surface"
                        }`}
                      >
                        {ar}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Image prompt modifier */}
                <div className="mb-6">
                  <label className="text-sm font-medium mb-1 block">
                    Image Prompt Modifier{" "}
                    <span className="text-muted font-normal">
                      (optional)
                    </span>
                  </label>
                  <textarea
                    value={imagePromptModifier}
                    onChange={(e) =>
                      setImagePromptModifier(e.target.value)
                    }
                    rows={3}
                    placeholder="Additional visual instructions for image generation..."
                    className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background resize-none"
                  />
                </div>
              </>
            )}

            {/* ── HTML Ad Template (Two-Layer System) ── */}
            {htmlTemplates.length > 0 && (
              <div className="mb-6 mt-2 border-t border-border pt-6">
                <h3 className="text-sm font-semibold mb-1">HTML Ad Templates</h3>
                <p className="text-xs text-muted mb-3">
                  Generate pixel-perfect ads with HTML templates. Text, pricing, and badges are rendered as HTML over an AI-generated background.
                </p>
                <div className="flex gap-2 flex-wrap">
                  {htmlTemplates.map((t) => (
                    <button
                      key={t.id}
                      type="button"
                      onClick={() => setHtmlTemplateId(htmlTemplateId === t.id ? null : t.id)}
                      className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                        htmlTemplateId === t.id
                          ? "bg-accent text-white border-accent"
                          : "bg-background border-border hover:bg-surface"
                      }`}
                    >
                      {t.name}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* ── Brief Review Sub-State ── */}
            {showBriefReview && briefData && (
              <div className="mb-6 mt-2 border-t border-border pt-6">
                <BriefReviewStep
                  briefs={briefData}
                  onApprove={handleBriefApproved}
                  onBack={() => setShowBriefReview(false)}
                  generating={generating}
                />
              </div>
            )}

            {/* Footer */}
            {!showBriefReview && (
              <div className="flex justify-between items-center">
                <button
                  type="button"
                  onClick={() => goToStep(1)}
                  className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-background transition-colors"
                >
                  Back
                </button>
                <div className="flex gap-2">
                  {htmlTemplateId && (
                    <button
                      type="button"
                      disabled={selectedWineIds.size === 0 || assemblingBrief}
                      onClick={handleAssembleBrief}
                      className="px-6 py-2 text-sm font-medium bg-green-600 text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {assemblingBrief ? "Assembling..." : `Preview HTML Ad${selectedWineIds.size > 1 ? "s" : ""}`}
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={!canGenerate}
                    onClick={handleGenerate}
                    className="px-6 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    Generate {totalAds} Ad{totalAds !== 1 ? "s" : ""}
                  </button>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════ Step 3: Review & Edit ══════ */}
        {step === 3 && (
          <div className="flex">
            {/* Main content */}
            <div
              className={`flex-1 min-w-0 ${showChat ? "border-r border-border" : ""}`}
            >
              {/* Generating state */}
              {generating && (
                <div className="flex flex-col items-center justify-center p-12 space-y-4">
                  <svg
                    className="animate-spin h-8 w-8 text-accent"
                    viewBox="0 0 24 24"
                    fill="none"
                  >
                    <circle
                      className="opacity-25"
                      cx="12"
                      cy="12"
                      r="10"
                      stroke="currentColor"
                      strokeWidth="4"
                    />
                    <path
                      className="opacity-75"
                      fill="currentColor"
                      d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                    />
                  </svg>
                  <div className="text-center">
                    <div className="text-sm font-medium">
                      Generating {generatingIdx} of {totalToGenerate}...
                    </div>
                    <div className="text-xs text-muted mt-1">
                      {mode === "basic"
                        ? "Generating copy for each wine..."
                        : "Generating copy + styled images..."}
                    </div>
                  </div>
                  <div className="w-64 h-2 bg-border rounded-full overflow-hidden">
                    <div
                      className="h-full bg-accent rounded-full transition-all duration-300"
                      style={{
                        width: `${totalToGenerate > 0 ? (generatingIdx / totalToGenerate) * 100 : 0}%`,
                      }}
                    />
                  </div>
                </div>
              )}

              {/* Results */}
              {!generating && results.length > 0 && (
                <div>
                  {/* Header */}
                  <div className="border-b border-border px-4 py-3 flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        onClick={() =>
                          handleToggleAll(
                            selectedAds.length !== validResults.length,
                          )
                        }
                        className="text-xs text-accent hover:underline"
                      >
                        {selectedAds.length === validResults.length
                          ? "Deselect All"
                          : "Select All"}
                      </button>
                      <span className="text-sm text-muted">
                        {selectedAds.length} of {results.length} selected
                      </span>
                    </div>
                    <div className="flex items-center gap-3">
                      <button
                        type="button"
                        disabled={savingAds || selectedAds.length === 0 || selectedAds.every((a) => savedAdIds.has(a.id))}
                        onClick={() => handleSaveAds(selectedAds.filter((a) => !savedAdIds.has(a.id)))}
                        className="text-xs text-accent hover:underline flex items-center gap-1 disabled:opacity-50 disabled:cursor-not-allowed"
                      >
                        <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                        </svg>
                        {savingAds ? "Saving..." : "Save Selected"}
                      </button>
                      <button
                        type="button"
                        onClick={() => setShowChat(!showChat)}
                        className="text-xs text-accent hover:underline flex items-center gap-1"
                      >
                        {showChat ? "Hide" : "Show"} AI Chat
                      </button>
                    </div>
                  </div>

                  {/* Ad rows */}
                  <div className="divide-y divide-border max-h-[50vh] overflow-y-auto">
                    {results.map((ad) => (
                      <div
                        key={ad.id}
                        className={`flex gap-4 p-4 transition-colors ${
                          ad.selected
                            ? "bg-surface"
                            : "bg-surface/50 opacity-60"
                        }`}
                      >
                        {/* Checkbox */}
                        <div className="shrink-0 pt-1">
                          <button
                            type="button"
                            onClick={() =>
                              handleToggleSelect(ad.id)
                            }
                            className={`w-5 h-5 rounded border-2 flex items-center justify-center transition-colors ${
                              ad.selected
                                ? "bg-accent border-accent"
                                : "bg-white border-gray-400 hover:border-accent"
                            }`}
                          >
                            {ad.selected && (
                              <svg
                                className="w-3 h-3 text-white"
                                fill="none"
                                viewBox="0 0 24 24"
                                stroke="currentColor"
                                strokeWidth={3}
                              >
                                <path
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                  d="M5 13l4 4L19 7"
                                />
                              </svg>
                            )}
                          </button>
                        </div>

                        {/* Thumbnail */}
                        <button
                          type="button"
                          className="shrink-0 w-48 h-48 relative rounded-lg overflow-hidden bg-background border border-border cursor-pointer hover:ring-2 hover:ring-accent/40 transition-shadow"
                          onClick={() => ad.imageBase64 && setLightboxImage({ src: `data:${ad.imageMimeType};base64,${ad.imageBase64}`, alt: ad.wineName })}
                        >
                          {ad.imageBase64 ? (
                            <Image
                              src={`data:${ad.imageMimeType};base64,${ad.imageBase64}`}
                              alt={ad.wineName}
                              fill
                              className="object-contain"
                              sizes="192px"
                              unoptimized
                            />
                          ) : (
                            <div className="flex items-center justify-center h-full text-muted text-[10px]">
                              No image
                            </div>
                          )}
                        </button>

                        {/* Copy fields */}
                        <div className="flex-1 min-w-0 space-y-1.5">
                          <div className="flex items-center gap-2">
                            <span className="text-xs font-semibold truncate">
                              {ad.wineName}
                            </span>
                            <span className="text-[9px] font-medium px-1.5 py-0.5 rounded bg-black/10 text-muted shrink-0">
                              {ad.mode}
                            </span>
                            {/* Per-ad save button */}
                            <button
                              type="button"
                              disabled={savingAds || savedAdIds.has(ad.id)}
                              onClick={() => handleSaveAds([ad])}
                              className="ml-auto shrink-0 text-[10px] px-2 py-1 rounded border flex items-center gap-1 transition-colors disabled:cursor-not-allowed"
                              style={{
                                borderColor: savedAdIds.has(ad.id) ? "var(--success)" : "var(--border)",
                                color: savedAdIds.has(ad.id) ? "var(--success)" : "var(--accent)",
                              }}
                            >
                              {savedAdIds.has(ad.id) ? (
                                <>
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                                  </svg>
                                  Saved
                                </>
                              ) : (
                                <>
                                  <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                                    <path strokeLinecap="round" strokeLinejoin="round" d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
                                  </svg>
                                  Save
                                </>
                              )}
                            </button>
                          </div>
                          <div>
                            <label className="text-[10px] text-muted uppercase tracking-wider">
                              Headline
                            </label>
                            <input
                              value={ad.copyVariation.headline}
                              onChange={(e) =>
                                handleUpdateResult(ad.id, {
                                  copyVariation: {
                                    ...ad.copyVariation,
                                    headline: e.target.value,
                                  },
                                })
                              }
                              className="w-full px-2 py-1 text-xs border border-border rounded bg-background focus:border-accent focus:outline-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted uppercase tracking-wider">
                              Primary Text
                            </label>
                            <textarea
                              value={ad.copyVariation.primaryText}
                              onChange={(e) =>
                                handleUpdateResult(ad.id, {
                                  copyVariation: {
                                    ...ad.copyVariation,
                                    primaryText: e.target.value,
                                  },
                                })
                              }
                              rows={2}
                              className="w-full px-2 py-1 text-xs border border-border rounded bg-background focus:border-accent focus:outline-none resize-none"
                            />
                          </div>
                          <div>
                            <label className="text-[10px] text-muted uppercase tracking-wider">
                              Description
                            </label>
                            <input
                              value={ad.copyVariation.description}
                              onChange={(e) =>
                                handleUpdateResult(ad.id, {
                                  copyVariation: {
                                    ...ad.copyVariation,
                                    description: e.target.value,
                                  },
                                })
                              }
                              className="w-full px-2 py-1 text-xs border border-border rounded bg-background focus:border-accent focus:outline-none"
                            />
                          </div>
                          <div className="text-[10px] text-muted truncate">
                            {ad.destinationUrl}
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>

                  {/* Footer */}
                  <div className="border-t border-border p-4 flex justify-between items-center">
                    <button
                      type="button"
                      onClick={() => goToStep(2)}
                      className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-background transition-colors"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      disabled={selectedAds.length === 0}
                      onClick={() => goToStep(4)}
                      className="px-6 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      Publish {selectedAds.length} Ad
                      {selectedAds.length !== 1 ? "s" : ""}
                    </button>
                  </div>
                </div>
              )}

              {/* Empty state */}
              {!generating && results.length === 0 && (
                <div className="p-12 text-center text-sm text-muted">
                  No ads generated yet. Go back to configure and
                  generate.
                </div>
              )}
            </div>

            {/* AI Chat sidebar */}
            {showChat && (
              <div className="w-80 flex flex-col bg-background shrink-0">
                <div className="p-4 border-b border-border">
                  <h3 className="text-sm font-semibold">
                    AI Copywriter
                  </h3>
                  <p className="text-xs text-muted mt-0.5">
                    Get help with ad copy
                  </p>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3 max-h-[40vh]">
                  {chatMessages.length === 0 && (
                    <div className="text-center text-xs text-muted py-4">
                      Ask for headline ideas, copy variations, or
                      feedback.
                    </div>
                  )}
                  {chatMessages.map((msg) => (
                    <div
                      key={msg.id}
                      className={`text-xs ${
                        msg.role === "user"
                          ? "bg-accent/10 rounded-lg p-2 ml-6"
                          : "p-1"
                      }`}
                    >
                      {msg.role === "assistant" &&
                        !msg.content &&
                        chatStreaming && (
                          <span className="text-muted italic">
                            Thinking...
                          </span>
                        )}
                      <div className="whitespace-pre-wrap">
                        {msg.content}
                      </div>
                    </div>
                  ))}
                  <div ref={chatEndRef} />
                </div>
                <div className="p-3 border-t border-border">
                  <div className="flex gap-2">
                    <input
                      type="text"
                      value={chatInput}
                      onChange={(e) => setChatInput(e.target.value)}
                      onKeyDown={(e) =>
                        e.key === "Enter" &&
                        !e.shiftKey &&
                        sendChat()
                      }
                      placeholder="Ask about copy..."
                      className="flex-1 px-2 py-1.5 text-xs border border-border rounded-lg bg-surface focus:outline-none focus:border-accent"
                      disabled={chatStreaming}
                    />
                    <button
                      onClick={sendChat}
                      disabled={
                        chatStreaming || !chatInput.trim()
                      }
                      className="px-3 py-1.5 text-xs font-medium bg-accent text-white rounded-lg hover:opacity-90 disabled:opacity-50 transition-opacity"
                    >
                      Send
                    </button>
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ══════ Step 4: Publish ══════ */}
        {step === 4 && (
          <div className="p-6 space-y-6">
            <div>
              <h2 className="text-lg font-semibold mb-1">
                Publish to Meta
              </h2>
              <p className="text-sm text-muted">
                {selectedAds.length} ad
                {selectedAds.length !== 1 ? "s" : ""} ready to publish.
              </p>
            </div>

            {/* Ad set picker */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Select Ad Set
              </label>
              {adsetsLoading ? (
                <p className="text-sm text-muted">
                  Loading ad sets from Meta...
                </p>
              ) : adsets.length === 0 ? (
                <p className="text-sm text-muted">
                  No ad sets found. Create one in Meta Ads Manager
                  first.
                </p>
              ) : (
                <select
                  value={selectedAdsetId}
                  onChange={(e) => setSelectedAdsetId(e.target.value)}
                  disabled={publishing || isDone}
                  className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
                >
                  <option value="">Choose an ad set...</option>
                  {adsets.map((as) => (
                    <option key={as.id} value={as.id}>
                      {as.name} ({as.effective_status})
                    </option>
                  ))}
                </select>
              )}
            </div>

            {/* Status choice */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Initial Status
              </label>
              <div className="flex gap-2">
                <button
                  type="button"
                  onClick={() => setPublishStatus("PAUSED")}
                  disabled={publishing || isDone}
                  className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                    publishStatus === "PAUSED"
                      ? "bg-accent text-white border-accent"
                      : "bg-background border-border hover:bg-surface"
                  }`}
                >
                  Paused
                </button>
                <button
                  type="button"
                  onClick={() => setPublishStatus("ACTIVE")}
                  disabled={publishing || isDone}
                  className={`px-4 py-2 text-sm rounded-lg border transition-colors ${
                    publishStatus === "ACTIVE"
                      ? "bg-accent text-white border-accent"
                      : "bg-background border-border hover:bg-surface"
                  }`}
                >
                  Active
                </button>
              </div>
            </div>

            {/* Ads list */}
            <div>
              <label className="text-sm font-medium mb-2 block">
                Ads to Publish
              </label>
              <div className="border border-border rounded-lg divide-y divide-border">
                {selectedAds.map((ad) => {
                  const result = publishResults.find(
                    (r) => r.adId === ad.id,
                  );
                  return (
                    <div
                      key={ad.id}
                      className="px-3 py-2 flex items-center justify-between"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="text-xs font-medium truncate">
                          {ad.wineName}
                        </div>
                        <div className="text-[10px] text-muted truncate">
                          {ad.copyVariation.headline} —{" "}
                          {ad.destinationUrl}
                        </div>
                      </div>
                      {result && (
                        <div className="ml-2 shrink-0 text-right">
                          <span
                            className={`text-[10px] font-medium px-2 py-0.5 rounded ${
                              result.status === "success"
                                ? "bg-green-100 text-green-800"
                                : "bg-red-100 text-red-800"
                            }`}
                          >
                            {result.status === "success"
                              ? `Ad ${result.metaAdId}`
                              : result.error ?? "Failed"}
                          </span>
                          {result.status === "error" &&
                            result.error &&
                            (() => {
                              const hint = getErrorHint(
                                result.error,
                              );
                              return hint ? (
                                <div className="text-[9px] text-muted mt-0.5 max-w-[250px]">
                                  {hint}
                                </div>
                              ) : null;
                            })()}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Global error */}
            {publishError && (
              <div className="text-sm text-danger bg-danger/10 rounded-lg px-4 py-3">
                <div>{publishError}</div>
                {(() => {
                  const hint = getErrorHint(publishError);
                  return hint ? (
                    <div className="text-xs mt-1 opacity-80">
                      {hint}
                    </div>
                  ) : null;
                })()}
              </div>
            )}

            {/* Results summary */}
            {isDone && (
              <div className="bg-background border border-border rounded-lg p-4">
                <h4 className="text-sm font-semibold mb-1">
                  Publish Complete
                </h4>
                <p className="text-xs text-muted">
                  {publishSuccessCount} succeeded, {publishFailCount}{" "}
                  failed
                </p>
              </div>
            )}

            {/* Footer */}
            <div className="flex justify-between items-center pt-2">
              <button
                type="button"
                onClick={() => goToStep(3)}
                disabled={publishing}
                className="px-4 py-2 text-sm border border-border rounded-lg hover:bg-background transition-colors disabled:opacity-50"
              >
                Back
              </button>
              {isDone ? (
                <button
                  type="button"
                  onClick={() =>
                    (window.location.href = "/wines")
                  }
                  className="px-6 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:opacity-90 transition-opacity"
                >
                  Done
                </button>
              ) : (
                <button
                  type="button"
                  disabled={publishing || !selectedAdsetId}
                  onClick={handlePublish}
                  className="px-6 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
                >
                  {publishing && (
                    <svg
                      className="animate-spin h-4 w-4"
                      viewBox="0 0 24 24"
                      fill="none"
                    >
                      <circle
                        className="opacity-25"
                        cx="12"
                        cy="12"
                        r="10"
                        stroke="currentColor"
                        strokeWidth="4"
                      />
                      <path
                        className="opacity-75"
                        fill="currentColor"
                        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
                      />
                    </svg>
                  )}
                  {publishing
                    ? "Publishing..."
                    : `Publish ${selectedAds.length} Ads`}
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Reference Ad Editor slide-over */}
      {editorOpen && (
        <ReferenceAdEditor
          mode={editorMode}
          referenceAd={
            editorMode === "edit" && editorRefAd
              ? { id: editorRefAd.id, label: editorRefAd.label, brand: "winespies", imageFile: editorRefAd.imageFile }
              : undefined
          }
          brandId="winespies"
          onSave={() => {
            setEditorOpen(false);
            refreshReferenceAds();
          }}
          onDelete={() => {
            setEditorOpen(false);
            refreshReferenceAds();
          }}
          onClose={() => setEditorOpen(false)}
        />
      )}

      {/* Lightbox overlay */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-50 bg-black/80 flex items-center justify-center p-8 cursor-pointer"
          onClick={() => setLightboxImage(null)}
        >
          <div className="relative max-w-full max-h-full" onClick={(e) => e.stopPropagation()}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={lightboxImage.src}
              alt={lightboxImage.alt}
              className="max-w-full max-h-[90vh] object-contain rounded-lg shadow-2xl"
            />
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="absolute -top-3 -right-3 w-8 h-8 bg-white rounded-full flex items-center justify-center shadow-lg text-gray-800 hover:bg-gray-100 transition-colors"
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default function AdBuilderPage() {
  return (
    <Suspense
      fallback={
        <div className="text-sm text-muted py-8">Loading...</div>
      }
    >
      <AdBuilderContent />
    </Suspense>
  );
}
