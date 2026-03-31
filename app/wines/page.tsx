"use client";

import { useEffect, useState } from "react";
import Image from "next/image";
import { useRouter } from "next/navigation";

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
  composite_bottle_image_urls: { url: string; large_3x?: { url: string }; small?: { url: string } };
  bottle_image_urls: { url: string; large_3x?: { url: string }; small?: { url: string } };
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

export default function WinesPage() {
  const [wines, setWines] = useState<WineSale[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [channelFilter, setChannelFilter] = useState<string>("");
  const [search, setSearch] = useState("");
  const [selectedIds, setSelectedIds] = useState<Set<number>>(new Set());
  const router = useRouter();

  useEffect(() => {
    fetch("/api/wines/current")
      .then((r) => r.json())
      .then((data) => {
        if (Array.isArray(data)) {
          setWines(data);
        } else {
          setError(data.error ?? "Unexpected response");
        }
      })
      .catch(() => setError("Failed to load wines"))
      .finally(() => setLoading(false));
  }, []);

  const channels = Array.from(new Set(wines.map((w) => w.channel.name))).sort();

  const filtered = wines.filter((w) => {
    if (w["sold_out?"]) return false;
    if (channelFilter && w.channel.name !== channelFilter) return false;
    if (search.trim()) {
      const q = search.toLowerCase();
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

  const toggleSelect = (id: number) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAll = () => {
    setSelectedIds(new Set(filtered.map((w) => w.id)));
  };

  const clearSelection = () => {
    setSelectedIds(new Set());
  };

  const buildAd = (wine: WineSale) => {
    router.push(`/ad-builder?type=pdp&wines=${wine.id}`);
  };

  const openBulkBuilder = () => {
    const ids = Array.from(selectedIds).join(",");
    router.push(`/ad-builder?type=pdp&wines=${ids}`);
  };

  return (
    <div className="pb-20">
      <h1 className="text-2xl font-semibold tracking-tight mb-1">Current Wines</h1>
      <p className="text-muted mb-6">
        Pick a wine to build static ad creatives, or select multiple for bulk ad generation.
      </p>

      <div className="flex gap-3 mb-5 flex-wrap items-center">
        <input
          type="text"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search wines..."
          className="px-3 py-2 text-sm border border-border rounded-lg bg-surface min-w-[220px]"
        />
        <select
          value={channelFilter}
          onChange={(e) => setChannelFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-surface"
        >
          <option value="">All channels</option>
          {channels.map((ch) => (
            <option key={ch} value={ch}>
              {ch}
            </option>
          ))}
        </select>
        <span className="text-xs text-muted self-center">
          {filtered.length} wine{filtered.length !== 1 ? "s" : ""} available
        </span>
        {filtered.length > 0 && (
          <button
            type="button"
            onClick={selectedIds.size === filtered.length ? clearSelection : selectAll}
            className="text-xs text-accent hover:underline self-center ml-auto"
          >
            {selectedIds.size === filtered.length ? "Deselect All" : "Select All"}
          </button>
        )}
      </div>

      {loading ? (
        <p className="text-sm text-muted">Loading wines...</p>
      ) : error ? (
        <div className="text-sm text-danger bg-danger/10 rounded-lg px-4 py-3">{error}</div>
      ) : filtered.length === 0 ? (
        <p className="text-sm text-muted">No wines match your search.</p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {filtered.map((wine) => {
            const pct = discount(wine.retail.cents, wine.price.cents);
            const img = bottleImg(wine);
            const isSelected = selectedIds.has(wine.id);
            return (
              <div
                key={wine.id}
                className={`rounded-xl border-2 bg-surface overflow-hidden flex flex-col transition-colors ${
                  isSelected
                    ? "border-accent ring-1 ring-accent/20"
                    : "border-border"
                }`}
              >
                {/* Bottle image */}
                <div className="relative bg-background flex items-center justify-center h-56">
                  {img ? (
                    <Image
                      src={img}
                      alt={wine.product.name}
                      fill
                      className="object-contain p-4"
                      sizes="(max-width: 640px) 100vw, 33vw"
                      unoptimized
                    />
                  ) : (
                    <span className="text-muted text-xs">No image</span>
                  )}
                  {pct > 0 && (
                    <span className="absolute top-2 right-2 bg-red-600 text-white text-xs font-bold px-2 py-0.5 rounded">
                      {pct}% OFF
                    </span>
                  )}
                  <span className="absolute top-2 left-2 bg-black/60 text-white text-[10px] font-medium px-2 py-0.5 rounded">
                    {wine.channel.name}
                  </span>
                  {/* Select checkbox */}
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      toggleSelect(wine.id);
                    }}
                    className={`absolute bottom-2 left-2 w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                      isSelected
                        ? "bg-accent border-accent"
                        : "bg-white/80 border-gray-400 hover:border-accent"
                    }`}
                  >
                    {isSelected && (
                      <svg
                        className="w-4 h-4 text-white"
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

                {/* Details */}
                <div className="p-4 flex flex-col flex-1">
                  <div className="text-xs text-muted mb-1">
                    {wine.product.producer.name} · {wine.product.vintage}
                  </div>
                  <h3 className="text-sm font-semibold leading-snug mb-1">
                    {wine.product.name}
                  </h3>
                  <div className="text-xs text-muted mb-2">
                    {wine.product.varietal.name} · {wine.product.region.display_name}
                  </div>

                  {/* Price row */}
                  <div className="flex items-baseline gap-2 mb-2">
                    <span className="text-lg font-bold text-accent">
                      {fmt$(wine.price.cents)}
                    </span>
                    {wine.retail.cents > wine.price.cents && (
                      <span className="text-sm text-muted line-through">
                        {fmt$(wine.retail.cents)}
                      </span>
                    )}
                  </div>

                  {/* Mini brief */}
                  <p className="text-xs text-muted line-clamp-2 mb-3 flex-1">
                    {stripHtml(wine.mini_brief)}
                  </p>

                  <div className="flex items-center justify-between mt-auto">
                    <span className="text-[10px] text-muted">
                      {wine.qty_remaining} left
                    </span>
                    <button
                      type="button"
                      onClick={() => buildAd(wine)}
                      className="px-4 py-1.5 text-sm font-medium bg-accent text-white rounded-lg hover:opacity-90 transition-opacity"
                    >
                      Build Ad
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Sticky bottom selection bar */}
      {selectedIds.size > 0 && (
        <div className="fixed bottom-0 left-0 right-0 z-40 bg-surface border-t border-border shadow-lg">
          <div className="max-w-7xl mx-auto px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <span className="text-sm font-medium">
                {selectedIds.size} wine{selectedIds.size !== 1 ? "s" : ""} selected
              </span>
              <button
                type="button"
                onClick={clearSelection}
                className="text-xs text-muted hover:text-foreground"
              >
                Clear
              </button>
            </div>
            <button
              type="button"
              onClick={openBulkBuilder}
              className="px-6 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              Build Ads
            </button>
          </div>
        </div>
      )}

    </div>
  );
}
