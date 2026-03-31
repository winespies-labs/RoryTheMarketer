"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { getLeafTag, tagSlugToLabel } from "@/lib/swipe-tagging";

const BRAND_ID = "winespies";

const ITEM_TYPES = [
  { value: "copywriting", label: "Copywriting" },
  { value: "ad_copy", label: "Ad Copy" },
  { value: "brief", label: "Brief" },
  { value: "reference_ad", label: "Reference Ad" },
  { value: "swipe", label: "Swipe" },
];

interface LibraryItem {
  id: string;
  type: string;
  title?: string;
  content: string;
  tags?: string[];
  meta?: Record<string, unknown>;
  addedAt: string;
}

interface SwipeFilesPanelProps {
  onChanged?: () => void;
}

export default function SwipeFilesPanel({ onChanged }: SwipeFilesPanelProps) {
  const [items, setItems] = useState<LibraryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [search, setSearch] = useState("");
  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const [modalItem, setModalItem] = useState<LibraryItem | null>(null);
  const [editTagsStr, setEditTagsStr] = useState("");
  const [modalSaving, setModalSaving] = useState(false);
  const [modalError, setModalError] = useState<string | null>(null);
  const [form, setForm] = useState({
    type: "swipe" as string,
    title: "",
    content: "",
    tagsStr: "",
    whyItWorks: "",
    riffIdea: "",
  });

  const fetchItems = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ brand: BRAND_ID });
    if (search) params.set("q", search);
    fetch(`/api/context-library?${params}`)
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [search]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const filteredItems = useMemo(() => {
    let arr = items;

    if (typeFilter) {
      // Historical note: you store most copy patterns as `type="swipe"`,
      // but you want to browse them under the "copywriting" bucket.
      const matchesType = (t: string) => {
        if (typeFilter === "copywriting") {
          return t === "copywriting" || t === "swipe";
        }
        return t === typeFilter;
      };
      arr = arr.filter((i) => matchesType(i.type));
    }

    if (selectedTag) arr = arr.filter((i) => i.tags?.includes(selectedTag));
    return arr;
  }, [items, selectedTag, typeFilter]);

  const primaryTagCounts = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const item of items) {
      const primary = item.tags?.[0];
      if (!primary) continue;
      counts[primary] = (counts[primary] ?? 0) + 1;
    }
    return counts;
  }, [items]);

  const topPrimaryTags = useMemo(() => {
    return Object.entries(primaryTagCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([tag]) => tag)
      .slice(0, 12);
  }, [primaryTagCounts]);

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    const tags = form.tagsStr.split(/[\s,]+/).filter(Boolean);
    const meta: Record<string, unknown> = {};
    if (form.whyItWorks.trim()) meta.whyItWorks = form.whyItWorks.trim();
    if (form.riffIdea.trim()) meta.riffIdea = form.riffIdea.trim();
    fetch("/api/context-library", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brand: BRAND_ID,
        type: form.type,
        title: form.title || undefined,
        content: form.content,
        tags: tags.length ? tags : undefined,
        meta: Object.keys(meta).length ? meta : undefined,
      }),
    })
      .then((r) => r.json())
      .then(() => {
        setForm({
          type: "swipe",
          title: "",
          content: "",
          tagsStr: "",
          whyItWorks: "",
          riffIdea: "",
        });
        fetchItems();
        onChanged?.();
      });
  };

  const handleDelete = (id: string) => {
    if (!confirm("Delete this item?")) return;
    fetch(`/api/context-library?brand=${BRAND_ID}&id=${id}`, { method: "DELETE" }).then(
      (r) => {
        if (r.ok) {
          fetchItems();
          onChanged?.();
        }
      }
    );
  };

  return (
    <div>
      <h2 className="text-lg font-semibold mb-4">Swipe Files</h2>

      {/* Filters */}
      <div className="flex gap-3 mb-3 flex-wrap">
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-surface min-w-[180px]"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-surface"
        >
          <option value="">All types</option>
          {ITEM_TYPES.map((t) => (
            <option key={t.value} value={t.value}>
              {t.label}
            </option>
          ))}
        </select>
      </div>

      {/* Tag chips */}
      <div className="flex gap-2 mb-6 flex-wrap">
        <button
          type="button"
          onClick={() => setSelectedTag(null)}
          className={`px-2.5 py-1.5 text-xs border rounded-full transition-colors ${
            !selectedTag
              ? "bg-accent text-white border-accent"
              : "bg-surface text-muted border-border hover:bg-background"
          }`}
        >
          All tags
        </button>
        {topPrimaryTags.map((tagSlug) => {
          const isActive = selectedTag === tagSlug;
          return (
            <button
              key={tagSlug}
              type="button"
              onClick={() => setSelectedTag(tagSlug)}
              className={`px-2.5 py-1.5 text-xs border rounded-full transition-colors ${
                isActive
                  ? "bg-accent text-white border-accent"
                  : "bg-surface text-muted border-border hover:bg-background"
              }`}
              title={tagSlug}
            >
              {tagSlugToLabel(getLeafTag(tagSlug))}
            </button>
          );
        })}
        {Object.keys(primaryTagCounts).length > topPrimaryTags.length ? (
          <span className="text-xs text-muted pt-2">
            +{Object.keys(primaryTagCounts).length - topPrimaryTags.length} more
          </span>
        ) : null}
      </div>

      {/* Add form */}
      <form onSubmit={handleAdd} className="rounded-lg border border-border bg-surface p-5 mb-6">
        <h3 className="font-medium text-sm mb-3">Add to library</h3>
        <div className="grid gap-3 sm:grid-cols-2">
          <div>
            <label className="block text-xs text-muted mb-1">Type</label>
            <select
              value={form.type}
              onChange={(e) => setForm((f) => ({ ...f, type: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
            >
              {ITEM_TYPES.map((t) => (
                <option key={t.value} value={t.value}>
                  {t.label}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Title (optional)</label>
            <input
              type="text"
              value={form.title}
              onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
            />
          </div>
          <div className="sm:col-span-2">
            <label className="block text-xs text-muted mb-1">Content</label>
            <textarea
              value={form.content}
              onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
              rows={4}
              required
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background resize-y"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Tags (comma-separated)</label>
            <input
              type="text"
              value={form.tagsStr}
              onChange={(e) => setForm((f) => ({ ...f, tagsStr: e.target.value }))}
              placeholder="hero, cta, Q1"
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Why it works (optional)</label>
            <textarea
              value={form.whyItWorks}
              onChange={(e) => setForm((f) => ({ ...f, whyItWorks: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background resize-y"
              placeholder="What mechanism is this demonstrating?"
            />
          </div>
          <div>
            <label className="block text-xs text-muted mb-1">Riff idea (optional)</label>
            <textarea
              value={form.riffIdea}
              onChange={(e) => setForm((f) => ({ ...f, riffIdea: e.target.value }))}
              rows={3}
              className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background resize-y"
              placeholder="How would you adapt this into your own copy?"
            />
          </div>
          <div className="flex items-end">
            <button
              type="submit"
              className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              Add to library
            </button>
          </div>
        </div>
      </form>

      {/* Items list */}
      {loading ? (
        <p className="text-muted text-sm">Loading...</p>
      ) : filteredItems.length === 0 ? (
        <p className="text-muted text-sm">No items yet. Add one above.</p>
      ) : (
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
          {filteredItems.map((item) => {
            const primaryTag = item.tags?.[0];
            return (
              <div
                key={item.id}
                className="rounded-lg border border-border bg-surface p-4 hover:bg-background transition-colors cursor-pointer"
                role="button"
                tabIndex={0}
                onClick={() => {
                  setModalItem(item);
                  setEditTagsStr(item.tags?.join(", ") ?? "");
                  setModalError(null);
                }}
                onKeyDown={(e) => {
                  if (e.key === "Enter" || e.key === " ") {
                    setModalItem(item);
                    setEditTagsStr(item.tags?.join(", ") ?? "");
                    setModalError(null);
                  }
                }}
              >
                <div className="flex items-start justify-between mb-1">
                  <div className="min-w-0">
                    <span className="font-medium text-sm truncate block">
                      {item.title || "(untitled)"}
                    </span>
                    <div className="mt-1 flex flex-wrap gap-1 items-center">
                      <span className="text-xs text-muted px-2 py-0.5 bg-accent-light rounded-full">
                        {item.type.replaceAll("_", " ")}
                      </span>
                      {primaryTag ? (
                        <span className="text-xs text-muted px-2 py-0.5 border border-border rounded-full bg-background">
                          {tagSlugToLabel(getLeafTag(primaryTag))}
                        </span>
                      ) : null}
                    </div>
                  </div>
                  <span className="text-xs text-muted">
                    {new Date(item.addedAt).toLocaleDateString()}
                  </span>
                </div>

                <p className="text-sm text-muted whitespace-pre-wrap line-clamp-3 mt-2">
                  {item.content}
                </p>

                {item.tags?.length ? (
                  <div className="mt-3 flex flex-wrap gap-1">
                    {item.tags.slice(0, 4).map((t) => (
                      <span
                        key={t}
                        className="text-xs text-muted px-2 py-0.5 border border-border rounded-full bg-background"
                        title={t}
                      >
                        {tagSlugToLabel(getLeafTag(t))}
                      </span>
                    ))}
                    {item.tags.length > 4 ? (
                      <span className="text-xs text-muted pt-1">+{item.tags.length - 4}</span>
                    ) : null}
                  </div>
                ) : null}

                <div className="mt-4 flex justify-end">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleDelete(item.id);
                    }}
                    className="text-xs text-danger hover:underline"
                  >
                    Delete
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Modal */}
      {modalItem ? (
        <div
          className="fixed inset-0 bg-black/30 flex items-center justify-center p-4 z-50"
          role="dialog"
          aria-modal="true"
          onClick={() => {
            setModalItem(null);
            setModalError(null);
            setEditTagsStr("");
          }}
        >
          <div
            className="bg-surface border border-border rounded-xl w-full max-w-3xl max-h-[80vh] overflow-y-auto p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-base font-semibold truncate">
                  {modalItem.title || "(untitled)"}
                </h3>
                <div className="mt-2 flex flex-wrap gap-2 items-center">
                  <span className="text-xs text-muted px-2 py-0.5 bg-accent-light rounded-full">
                    {modalItem.type.replaceAll("_", " ")}
                  </span>
                  {modalItem.tags?.length ? (
                    <span className="text-xs text-muted px-2 py-0.5 border border-border rounded-full bg-background">
                      {tagSlugToLabel(getLeafTag(modalItem.tags[0]))}
                    </span>
                  ) : null}
                  <span className="text-xs text-muted">
                    {new Date(modalItem.addedAt).toLocaleDateString()}
                  </span>
                </div>
              </div>
              <button
                type="button"
                onClick={() => setModalItem(null)}
                className="px-3 py-1.5 text-sm border border-border rounded-lg bg-background hover:bg-surface"
              >
                Close
              </button>
            </div>

            <div className="mt-4">
              <div className="text-xs font-medium text-muted mb-2">Quote</div>
              <div className="text-sm whitespace-pre-wrap text-muted leading-relaxed">
                {modalItem.content}
              </div>
            </div>

            {modalItem.tags?.length ? (
              <div className="mt-4">
                <div className="text-xs font-medium text-muted mb-2">Tags</div>
                <div className="flex flex-wrap gap-2">
                  {modalItem.tags.map((t) => (
                    <button
                      key={t}
                      type="button"
                      onClick={() => setSelectedTag(t)}
                      className="text-xs text-muted px-2 py-0.5 border border-border rounded-full bg-background hover:bg-surface"
                      title={t}
                    >
                      {tagSlugToLabel(getLeafTag(t))}
                    </button>
                  ))}
                </div>
              </div>
            ) : null}

            <div className="mt-4">
              <div className="flex items-center justify-between gap-4 mb-2">
                <div className="text-xs font-medium text-muted">Edit tags</div>
                {modalSaving ? (
                  <div className="text-xs text-muted">Saving...</div>
                ) : null}
              </div>
              <input
                type="text"
                value={editTagsStr}
                onChange={(e) => setEditTagsStr(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
                placeholder="e.g. openers_intros/nostalgia_time, pop_reference"
              />
              {modalError ? (
                <div className="mt-2 text-xs text-danger bg-red-50 border border-red-200 rounded-lg p-2">
                  {modalError}
                </div>
              ) : null}
              <div className="mt-3 flex justify-end">
                <button
                  type="button"
                  disabled={modalSaving}
                  onClick={async () => {
                    if (!modalItem) return;
                    setModalSaving(true);
                    setModalError(null);
                    try {
                      const tags = editTagsStr
                        .split(/[\s,]+/)
                        .map((t) => t.trim())
                        .filter(Boolean);

                      const res = await fetch("/api/context-library", {
                        method: "PATCH",
                        headers: { "Content-Type": "application/json" },
                        body: JSON.stringify({
                          brand: BRAND_ID,
                          id: modalItem.id,
                          title: modalItem.title,
                          content: modalItem.content,
                          meta: modalItem.meta,
                          tags: tags.length ? tags : undefined,
                        }),
                      });

                      const d = await res.json();
                      if (!res.ok) {
                        throw new Error(d?.error || "Failed to update tags");
                      }

                      setModalItem(null);
                      setEditTagsStr("");
                      onChanged?.();
                      fetchItems();
                    } catch (err) {
                      setModalError(err instanceof Error ? err.message : "Failed to save tags");
                    } finally {
                      setModalSaving(false);
                    }
                  }}
                  className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:opacity-90 transition-opacity disabled:opacity-50"
                >
                  Save tags
                </button>
              </div>
            </div>

            {/* meta fields (present if you imported/added them) */}
            {modalItem.meta?.whyItWorks || modalItem.meta?.riffIdea ? (
              <div className="mt-4">
                <div className="text-xs font-medium text-muted mb-2">Notes</div>
                <div className="space-y-3">
                  {typeof modalItem.meta?.whyItWorks === "string" &&
                  modalItem.meta.whyItWorks ? (
                    <div>
                      <div className="text-xs font-medium text-muted mb-1">
                        Why it works
                      </div>
                      <div className="text-sm whitespace-pre-wrap text-muted leading-relaxed">
                        {modalItem.meta.whyItWorks}
                      </div>
                    </div>
                  ) : null}
                  {typeof modalItem.meta?.riffIdea === "string" &&
                  modalItem.meta.riffIdea ? (
                    <div>
                      <div className="text-xs font-medium text-muted mb-1">
                        Riff idea
                      </div>
                      <div className="text-sm whitespace-pre-wrap text-muted leading-relaxed">
                        {modalItem.meta.riffIdea}
                      </div>
                    </div>
                  ) : null}
                </div>
              </div>
            ) : null}

            <div className="mt-6 flex justify-end">
              <button
                type="button"
                onClick={() => {
                  const id = modalItem.id;
                  setModalItem(null);
                  handleDelete(id);
                }}
                className="text-sm text-danger hover:underline"
              >
                Delete this item
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}
