"use client";

import { useEffect, useState } from "react";

const BRAND_ID = "winespies";

interface BrandInfo {
  id: string;
  name: string;
  domain?: string;
  metaAdAccountId?: string;
}

export default function AdAccountPanel() {
  const [brand, setBrand] = useState<BrandInfo | null>(null);

  useEffect(() => {
    fetch("/api/brands")
      .then((r) => r.json())
      .then((brands: BrandInfo[]) => {
        const b = brands.find((b) => b.id === BRAND_ID);
        if (b) setBrand(b);
      })
      .catch(() => {});
  }, []);

  if (!brand) {
    return <div className="text-muted text-sm py-8 text-center">Loading...</div>;
  }

  const fields = [
    { label: "Brand Name", value: brand.name },
    { label: "Domain", value: brand.domain || "Not set" },
    { label: "Meta Ad Account ID", value: brand.metaAdAccountId || "Not set" },
  ];

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Ad Account Details</h2>

      <div className="rounded-lg border border-border bg-surface divide-y divide-border">
        {fields.map((f) => (
          <div key={f.label} className="flex items-center justify-between px-5 py-3">
            <span className="text-sm text-muted">{f.label}</span>
            <span className="text-sm font-medium font-mono">{f.value}</span>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted mt-3">
        These values are configured in <code className="text-xs">lib/brands.ts</code> and environment variables.
      </p>
    </div>
  );
}
