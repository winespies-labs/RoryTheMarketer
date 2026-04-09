"use client";

import { useCallback, useEffect, useState } from "react";
import { CATEGORIES, getSectionDef } from "@/lib/context-sections";
import Sidebar from "./components/Sidebar";
import MarkdownEditor from "./components/MarkdownEditor";
import MetaCommentsPanel from "./components/MetaCommentsPanel";
import BrandAssetsPanel from "./components/BrandAssetsPanel";
import ReviewsPanel from "./components/ReviewsPanel";

const BRAND_ID = "winespies";

export default function ContextHubPage() {
  const [activeSection, setActiveSection] = useState(
    CATEGORIES[0].sections[0].id
  );
  const [status, setStatus] = useState<Record<string, boolean>>({});

  const fetchStatus = useCallback(() => {
    fetch(`/api/context/status?brand=${BRAND_ID}`)
      .then((r) => r.json())
      .then((d) => setStatus(d.status ?? {}))
      .catch(() => {});
  }, []);

  useEffect(() => {
    fetchStatus();
  }, [fetchStatus]);

  const section = getSectionDef(activeSection);

  const renderContent = () => {
    if (!section) return null;

    switch (section.type) {
      case "markdown":
        return (
          <MarkdownEditor
            key={section.id}
            sectionId={section.id}
            label={section.label}
            onSaved={fetchStatus}
          />
        );
      case "meta-comments":
        return <MetaCommentsPanel />;
      case "brand-assets":
        return <BrandAssetsPanel onChanged={fetchStatus} />;
      case "reviews":
        return <ReviewsPanel />;
      default:
        return null;
    }
  };

  return (
    <div className="-mx-8 -my-8 flex min-h-screen">
      <Sidebar
        activeSection={activeSection}
        onSelect={setActiveSection}
        status={status}
      />

      <main className="flex-1 min-w-0 p-8 overflow-y-auto">
        {renderContent()}
      </main>
    </div>
  );
}
