"use client";

import { useCallback, useEffect, useState } from "react";
import { CTA_OPTIONS, type CtaType } from "@/app/ads-manager/workshop/types";

const BRAND_ID = "winespies";
const STORAGE_KEY = "ws_ad_defaults";

type Defaults = {
  destinationUrl: string;
  ctaType: CtaType;
};

export default function SettingsPage() {
  const [accountId, setAccountId] = useState<string | null>(null);
  const [syncedAt, setSyncedAt] = useState<string | null>(null);
  const [campaignCount, setCampaignCount] = useState(0);
  const [adsetCount, setAdsetCount] = useState(0);
  const [adCount, setAdCount] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [syncError, setSyncError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);

  const [defaults, setDefaults] = useState<Defaults>({
    destinationUrl: "",
    ctaType: "SHOP_NOW",
  });

  // Load defaults from localStorage
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const parsed = JSON.parse(raw);
        setDefaults({
          destinationUrl: parsed.destinationUrl ?? "",
          ctaType: parsed.ctaType ?? "SHOP_NOW",
        });
      }
    } catch {}
  }, []);

  // Fetch account info from campaigns
  const fetchInfo = useCallback(async () => {
    try {
      const [campRes, adsetRes, adRes] = await Promise.all([
        fetch(`/api/meta-ads/campaigns?brand=${BRAND_ID}&timeRange=last_7d`),
        fetch(`/api/meta-ads/adsets?brand=${BRAND_ID}&timeRange=last_7d`),
        fetch(`/api/meta-ads/ads?brand=${BRAND_ID}&timeRange=last_7d`),
      ]);
      const campData = await campRes.json();
      const adsetData = await adsetRes.json();
      const adData = await adRes.json();

      setAccountId(campData.accountId ?? null);
      setSyncedAt(campData.syncedAt ?? null);
      setCampaignCount(campData.campaigns?.length ?? 0);
      setAdsetCount(adsetData.adsets?.length ?? 0);
      setAdCount(adData.ads?.length ?? 0);
    } catch {}
  }, []);

  useEffect(() => {
    fetchInfo();
  }, [fetchInfo]);

  const handleSync = async () => {
    setSyncing(true);
    setSyncError(null);
    try {
      const res = await fetch("/api/meta-ads/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ brand: BRAND_ID }),
      });
      const data = await res.json();
      if (!data.ok) {
        setSyncError(data.error ?? "Sync failed");
      } else {
        await fetchInfo();
      }
    } catch {
      setSyncError("Sync request failed");
    } finally {
      setSyncing(false);
    }
  };

  const saveDefaults = () => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(defaults));
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Account Info */}
      <div className="bg-surface border border-border rounded-lg p-5">
        <h2 className="text-sm font-semibold mb-4">Account Info</h2>
        <div className="space-y-2 text-sm">
          <div className="flex justify-between">
            <span className="text-muted">Account ID</span>
            <span className="font-mono">{accountId ?? "—"}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Last sync</span>
            <span>{syncedAt ? new Date(syncedAt).toLocaleString() : "Never"}</span>
          </div>
        </div>
      </div>

      {/* Sync Status */}
      <div className="bg-surface border border-border rounded-lg p-5">
        <h2 className="text-sm font-semibold mb-4">Sync Status</h2>
        <div className="space-y-2 text-sm mb-4">
          <div className="flex justify-between">
            <span className="text-muted">Campaigns</span>
            <span>{campaignCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Ad Sets</span>
            <span>{adsetCount}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Ads</span>
            <span>{adCount}</span>
          </div>
        </div>

        {syncError && (
          <div className="mb-3 px-3 py-2 bg-danger/10 text-danger text-sm rounded-md">{syncError}</div>
        )}

        <button
          onClick={handleSync}
          disabled={syncing}
          className="px-4 py-1.5 text-sm font-medium bg-accent text-white rounded-md hover:opacity-90 disabled:opacity-50 transition-opacity"
        >
          {syncing ? "Syncing..." : "Sync Now"}
        </button>
      </div>

      {/* Ad Defaults */}
      <div className="bg-surface border border-border rounded-lg p-5">
        <h2 className="text-sm font-semibold mb-4">Ad Defaults</h2>
        <p className="text-xs text-muted mb-4">These defaults will be pre-filled when creating new ads in Workshop.</p>

        <div className="space-y-4">
          <div>
            <label className="block text-xs font-medium text-muted mb-1">Destination URL</label>
            <input
              type="url"
              value={defaults.destinationUrl}
              onChange={(e) => setDefaults((d) => ({ ...d, destinationUrl: e.target.value }))}
              placeholder="https://winespies.com/..."
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-muted mb-1">Default CTA</label>
            <select
              value={defaults.ctaType}
              onChange={(e) => setDefaults((d) => ({ ...d, ctaType: e.target.value as CtaType }))}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent bg-white"
            >
              {CTA_OPTIONS.map((opt) => (
                <option key={opt.value} value={opt.value}>{opt.label}</option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-3">
            <button
              onClick={saveDefaults}
              className="px-4 py-1.5 text-sm font-medium bg-accent text-white rounded-md hover:opacity-90 transition-opacity"
            >
              Save Defaults
            </button>
            {saved && <span className="text-sm text-success">Saved</span>}
          </div>
        </div>
      </div>
    </div>
  );
}
