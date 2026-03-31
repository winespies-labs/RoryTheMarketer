"use client";

import { type AdElements, type CreativeImage, CTA_OPTIONS, type CtaType } from "../types";

interface Props {
  elements: AdElements;
  onChange: (elements: AdElements) => void;
  creatives: CreativeImage[];
  selectedCreativeId: string | null;
  onSelectCreative: (id: string) => void;
}

export default function AdElementsPanel({
  elements,
  onChange,
  creatives,
  selectedCreativeId,
  onSelectCreative,
}: Props) {
  const update = (field: keyof AdElements, value: string) => {
    onChange({ ...elements, [field]: value });
  };

  return (
    <div className="w-80 border-r border-border flex flex-col bg-white overflow-y-auto">
      <div className="p-4 border-b border-border">
        <h2 className="text-sm font-semibold text-foreground">Ad Elements</h2>
      </div>

      <div className="p-4 space-y-4 flex-1">
        {/* Headline */}
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Headline</label>
          <input
            type="text"
            value={elements.headline}
            onChange={(e) => update("headline", e.target.value)}
            placeholder="Your headline..."
            className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
          />
        </div>

        {/* Primary Text */}
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Primary Text</label>
          <textarea
            value={elements.primaryText}
            onChange={(e) => update("primaryText", e.target.value)}
            placeholder="Ad copy that appears above the image..."
            rows={4}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent resize-none"
          />
        </div>

        {/* Description */}
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Description</label>
          <input
            type="text"
            value={elements.description}
            onChange={(e) => update("description", e.target.value)}
            placeholder="Link description..."
            className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
          />
        </div>

        {/* CTA */}
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Call to Action</label>
          <select
            value={elements.ctaType}
            onChange={(e) => update("ctaType", e.target.value as CtaType)}
            className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent bg-white"
          >
            {CTA_OPTIONS.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        </div>

        {/* Destination URL */}
        <div>
          <label className="block text-xs font-medium text-muted mb-1">Destination URL</label>
          <input
            type="url"
            value={elements.destinationUrl}
            onChange={(e) => update("destinationUrl", e.target.value)}
            placeholder="https://..."
            className="w-full px-3 py-2 text-sm border border-border rounded-lg focus:outline-none focus:ring-2 focus:ring-accent/30 focus:border-accent"
          />
        </div>
      </div>

      {/* Creatives Carousel */}
      {creatives.length > 0 && (
        <div className="p-4 border-t border-border">
          <h3 className="text-xs font-medium text-muted mb-2">
            Creatives ({creatives.length})
          </h3>
          <div className="flex gap-2 overflow-x-auto pb-1">
            {creatives.map((img) => (
              <button
                key={img.id}
                type="button"
                onClick={() => onSelectCreative(img.id)}
                className={`flex-shrink-0 w-16 h-16 rounded-lg overflow-hidden border-2 transition-colors ${
                  selectedCreativeId === img.id
                    ? "border-accent"
                    : "border-border hover:border-muted"
                }`}
              >
                <img
                  src={`data:${img.mimeType};base64,${img.base64}`}
                  alt={img.prompt ?? "Creative"}
                  className="w-full h-full object-cover"
                />
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
