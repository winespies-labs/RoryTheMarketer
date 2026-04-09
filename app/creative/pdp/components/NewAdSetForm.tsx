"use client";

import type { MetaCampaignLive, MetaAudience } from "@/lib/meta-publish";

export interface NewAdSetFormState {
  campaignId: string;
  name: string;
  budgetType: "daily" | "lifetime";
  budgetAmount: string;
  startDate: string;
  endDate: string;
  optimizationGoal: string;
  bidStrategy: "LOWEST_COST_WITHOUT_CAP" | "COST_CAP" | "BID_CAP";
  bidAmount: string;
  geoCountries: string[];
  ageMin: string;
  ageMax: string;
  gender: "all" | "male" | "female";
  selectedAudiences: MetaAudience[];
  placementMode: "automatic" | "manual";
  publisherPlatforms: string[];
  facebookPositions: string[];
  instagramPositions: string[];
}

export const DEFAULT_NEW_AD_SET: NewAdSetFormState = {
  campaignId: "",
  name: "",
  budgetType: "daily",
  budgetAmount: "",
  startDate: new Date().toISOString().split("T")[0],
  endDate: "",
  optimizationGoal: "OFFSITE_CONVERSIONS",
  bidStrategy: "LOWEST_COST_WITHOUT_CAP",
  bidAmount: "",
  geoCountries: ["US"],
  ageMin: "18",
  ageMax: "65",
  gender: "all",
  selectedAudiences: [],
  placementMode: "automatic",
  publisherPlatforms: [],
  facebookPositions: [],
  instagramPositions: [],
};

const OPTIMIZATION_GOALS = [
  { value: "OFFSITE_CONVERSIONS", label: "Conversions" },
  { value: "LINK_CLICKS", label: "Link Clicks" },
  { value: "REACH", label: "Reach" },
  { value: "IMPRESSIONS", label: "Impressions" },
  { value: "LANDING_PAGE_VIEWS", label: "Landing Page Views" },
  { value: "VALUE", label: "Value (purchase value optimization)" },
];

const FACEBOOK_POSITIONS = [
  { value: "feed", label: "Feed" },
  { value: "story", label: "Stories" },
  { value: "reels", label: "Reels" },
  { value: "right_hand_column", label: "Right Column" },
];

const INSTAGRAM_POSITIONS = [
  { value: "stream", label: "Feed" },
  { value: "story", label: "Stories" },
  { value: "reels", label: "Reels" },
  { value: "explore", label: "Explore" },
];

interface Props {
  campaigns: MetaCampaignLive[];
  audiences: MetaAudience[];
  value: NewAdSetFormState;
  onChange: (updates: Partial<NewAdSetFormState>) => void;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold text-muted uppercase tracking-wide mb-2">
      {children}
    </p>
  );
}

function FieldRow({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-muted">{label}</label>
      {children}
    </div>
  );
}

const inputCls =
  "px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-accent w-full";
const selectCls =
  "px-3 py-2 text-sm border border-border rounded-lg bg-background focus:outline-none focus:ring-1 focus:ring-accent w-full";

export default function NewAdSetForm({
  campaigns,
  audiences,
  value,
  onChange,
}: Props) {
  function togglePlatform(platform: string) {
    const current = value.publisherPlatforms;
    onChange({
      publisherPlatforms: current.includes(platform)
        ? current.filter((p) => p !== platform)
        : [...current, platform],
    });
  }

  function togglePosition(
    field: "facebookPositions" | "instagramPositions",
    pos: string,
  ) {
    const current = value[field];
    onChange({
      [field]: current.includes(pos)
        ? current.filter((p) => p !== pos)
        : [...current, pos],
    });
  }

  function toggleAudience(audience: MetaAudience) {
    const already = value.selectedAudiences.some((a) => a.id === audience.id);
    onChange({
      selectedAudiences: already
        ? value.selectedAudiences.filter((a) => a.id !== audience.id)
        : [...value.selectedAudiences, audience],
    });
  }

  function addCountry(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter" && e.key !== ",") return;
    e.preventDefault();
    const code = (e.currentTarget.value ?? "").trim().toUpperCase();
    if (code.length === 2 && !value.geoCountries.includes(code)) {
      onChange({ geoCountries: [...value.geoCountries, code] });
      e.currentTarget.value = "";
    }
  }

  function removeCountry(code: string) {
    onChange({ geoCountries: value.geoCountries.filter((c) => c !== code) });
  }

  const needsBidAmount =
    value.bidStrategy === "COST_CAP" || value.bidStrategy === "BID_CAP";

  return (
    <div className="flex flex-col gap-5">
      {/* Identity */}
      <div>
        <SectionLabel>Identity</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <FieldRow label="Ad set name">
            <input
              type="text"
              placeholder="e.g. Retargeting — Wine Lovers"
              value={value.name}
              onChange={(e) => onChange({ name: e.target.value })}
              className={inputCls}
            />
          </FieldRow>
          <FieldRow label="Campaign">
            <select
              value={value.campaignId}
              onChange={(e) => onChange({ campaignId: e.target.value })}
              className={selectCls}
            >
              <option value="">Select campaign…</option>
              {campaigns.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name} ({c.effective_status})
                </option>
              ))}
            </select>
          </FieldRow>
        </div>
      </div>

      {/* Budget */}
      <div>
        <SectionLabel>Budget</SectionLabel>
        <div className="flex gap-2 mb-3">
          {(["daily", "lifetime"] as const).map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => onChange({ budgetType: t })}
              className={`px-4 py-1.5 text-sm rounded-lg border transition-colors ${
                value.budgetType === t
                  ? "border-accent bg-accent/10 text-accent font-medium"
                  : "border-border text-muted hover:text-foreground"
              }`}
            >
              {t === "daily" ? "Daily" : "Lifetime"}
            </button>
          ))}
        </div>
        <div className="grid grid-cols-3 gap-3">
          <FieldRow label="Amount ($)">
            <input
              type="number"
              min="1"
              step="0.01"
              placeholder="0.00"
              value={value.budgetAmount}
              onChange={(e) => onChange({ budgetAmount: e.target.value })}
              className={inputCls}
            />
          </FieldRow>
          <FieldRow label="Start date">
            <input
              type="date"
              value={value.startDate}
              onChange={(e) => onChange({ startDate: e.target.value })}
              className={inputCls}
            />
          </FieldRow>
          {value.budgetType === "lifetime" && (
            <FieldRow label="End date">
              <input
                type="date"
                value={value.endDate}
                min={value.startDate}
                onChange={(e) => onChange({ endDate: e.target.value })}
                className={inputCls}
              />
            </FieldRow>
          )}
        </div>
      </div>

      {/* Optimization & Bidding */}
      <div>
        <SectionLabel>Optimization &amp; Bidding</SectionLabel>
        <div className="grid grid-cols-2 gap-3">
          <FieldRow label="Optimization goal">
            <select
              value={value.optimizationGoal}
              onChange={(e) => onChange({ optimizationGoal: e.target.value })}
              className={selectCls}
            >
              {OPTIMIZATION_GOALS.map((g) => (
                <option key={g.value} value={g.value}>
                  {g.label}
                </option>
              ))}
            </select>
          </FieldRow>
          <FieldRow label="Bid strategy">
            <select
              value={value.bidStrategy}
              onChange={(e) =>
                onChange({
                  bidStrategy: e.target.value as NewAdSetFormState["bidStrategy"],
                })
              }
              className={selectCls}
            >
              <option value="LOWEST_COST_WITHOUT_CAP">
                Lowest cost (automatic)
              </option>
              <option value="COST_CAP">Cost cap</option>
              <option value="BID_CAP">Bid cap</option>
            </select>
          </FieldRow>
          {needsBidAmount && (
            <FieldRow label="Bid / cost cap ($)">
              <input
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                value={value.bidAmount}
                onChange={(e) => onChange({ bidAmount: e.target.value })}
                className={inputCls}
              />
            </FieldRow>
          )}
        </div>
        <p className="text-[11px] text-muted mt-2">
          Billing event: Impressions (applied automatically)
        </p>
      </div>

      {/* Targeting */}
      <div>
        <SectionLabel>Targeting</SectionLabel>
        <div className="flex flex-col gap-4">
          {/* Audiences */}
          <FieldRow label="Custom & lookalike audiences">
            <div className="border border-border rounded-lg max-h-36 overflow-y-auto">
              {audiences.length === 0 ? (
                <p className="text-xs text-muted px-3 py-2">
                  No audiences found
                </p>
              ) : (
                audiences.map((a) => {
                  const checked = value.selectedAudiences.some(
                    (s) => s.id === a.id,
                  );
                  return (
                    <label
                      key={a.id}
                      className="flex items-center gap-2 px-3 py-1.5 text-sm hover:bg-surface cursor-pointer"
                    >
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={() => toggleAudience(a)}
                        className="accent-accent"
                      />
                      <span className="flex-1 truncate">{a.name}</span>
                      <span className="text-[10px] text-muted shrink-0">
                        {a.subtype}
                      </span>
                    </label>
                  );
                })
              )}
            </div>
          </FieldRow>

          {/* Geo */}
          <FieldRow label="Countries (type 2-letter code + Enter)">
            <div className="flex flex-wrap gap-1.5 border border-border rounded-lg px-3 py-2 min-h-[40px]">
              {value.geoCountries.map((c) => (
                <span
                  key={c}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-accent/10 text-accent text-xs rounded-full"
                >
                  {c}
                  <button
                    type="button"
                    onClick={() => removeCountry(c)}
                    className="hover:text-danger"
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                type="text"
                maxLength={2}
                placeholder="US"
                onKeyDown={addCountry}
                className="text-sm bg-transparent outline-none w-10 min-w-0"
              />
            </div>
          </FieldRow>

          {/* Age + Gender */}
          <div className="grid grid-cols-3 gap-3">
            <FieldRow label="Min age">
              <input
                type="number"
                min="18"
                max="65"
                value={value.ageMin}
                onChange={(e) => onChange({ ageMin: e.target.value })}
                className={inputCls}
              />
            </FieldRow>
            <FieldRow label="Max age (65 = no limit)">
              <input
                type="number"
                min="18"
                max="65"
                value={value.ageMax}
                onChange={(e) => onChange({ ageMax: e.target.value })}
                className={inputCls}
              />
            </FieldRow>
            <FieldRow label="Gender">
              <select
                value={value.gender}
                onChange={(e) =>
                  onChange({
                    gender: e.target.value as NewAdSetFormState["gender"],
                  })
                }
                className={selectCls}
              >
                <option value="all">All</option>
                <option value="male">Men</option>
                <option value="female">Women</option>
              </select>
            </FieldRow>
          </div>
        </div>
      </div>

      {/* Placements */}
      <div>
        <SectionLabel>Placements</SectionLabel>
        <div className="flex gap-2 mb-3">
          {(["automatic", "manual"] as const).map((m) => (
            <button
              key={m}
              type="button"
              onClick={() => onChange({ placementMode: m })}
              className={`px-4 py-1.5 text-sm rounded-lg border transition-colors ${
                value.placementMode === m
                  ? "border-accent bg-accent/10 text-accent font-medium"
                  : "border-border text-muted hover:text-foreground"
              }`}
            >
              {m === "automatic" ? "Automatic" : "Manual"}
            </button>
          ))}
        </div>

        {value.placementMode === "manual" && (
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-xs text-muted mb-2">Facebook</p>
              <label className="flex items-center gap-2 text-xs text-muted mb-1.5">
                <input
                  type="checkbox"
                  checked={value.publisherPlatforms.includes("facebook")}
                  onChange={() => togglePlatform("facebook")}
                  className="accent-accent"
                />
                Enable Facebook
              </label>
              {value.publisherPlatforms.includes("facebook") &&
                FACEBOOK_POSITIONS.map((p) => (
                  <label
                    key={p.value}
                    className="flex items-center gap-2 text-xs text-foreground pl-5 mb-1"
                  >
                    <input
                      type="checkbox"
                      checked={value.facebookPositions.includes(p.value)}
                      onChange={() =>
                        togglePosition("facebookPositions", p.value)
                      }
                      className="accent-accent"
                    />
                    {p.label}
                  </label>
                ))}
            </div>
            <div>
              <p className="text-xs text-muted mb-2">Instagram</p>
              <label className="flex items-center gap-2 text-xs text-muted mb-1.5">
                <input
                  type="checkbox"
                  checked={value.publisherPlatforms.includes("instagram")}
                  onChange={() => togglePlatform("instagram")}
                  className="accent-accent"
                />
                Enable Instagram
              </label>
              {value.publisherPlatforms.includes("instagram") &&
                INSTAGRAM_POSITIONS.map((p) => (
                  <label
                    key={p.value}
                    className="flex items-center gap-2 text-xs text-foreground pl-5 mb-1"
                  >
                    <input
                      type="checkbox"
                      checked={value.instagramPositions.includes(p.value)}
                      onChange={() =>
                        togglePosition("instagramPositions", p.value)
                      }
                      className="accent-accent"
                    />
                    {p.label}
                  </label>
                ))}
            </div>
          </div>
        )}
      </div>

      <p className="text-xs text-muted border-t border-border pt-3">
        Ad set will be created as <strong>Paused</strong>. Activate it in Meta
        Ads Manager after reviewing.
      </p>
    </div>
  );
}
