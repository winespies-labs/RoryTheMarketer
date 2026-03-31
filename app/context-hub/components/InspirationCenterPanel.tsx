"use client";

import { useCallback, useEffect, useState } from "react";

const BRAND_ID = "winespies";

type StyleOption = { value: string; label: string };
type CategoryOption = { value: string; label: string };

interface InspirationItem {
  id: string;
  type: "copy" | "image";
  content: string;
  title?: string;
  style?: string;
  category?: string;
  tags?: string[];
  imageFile?: string;
  hasStoredImage?: boolean;
  useInContext?: boolean;
  addedAt: string;
}

interface InspirationCenterPanelProps {
  onChanged?: () => void;
}

export default function InspirationCenterPanel({
  onChanged,
}: InspirationCenterPanelProps) {
  const [items, setItems] = useState<InspirationItem[]>([]);
  const [styles, setStyles] = useState<StyleOption[]>([]);
  const [categories, setCategories] = useState<CategoryOption[]>([]);
  const [loading, setLoading] = useState(true);
  const [typeFilter, setTypeFilter] = useState("");
  const [styleFilter, setStyleFilter] = useState("");
  const [categoryFilter, setCategoryFilter] = useState("");
  const [search, setSearch] = useState("");

  // Add copy form
  const [copyForm, setCopyForm] = useState({
    title: "",
    content: "",
    style: "",
    category: "",
    tagsStr: "",
    useInContext: false,
  });

  // Add screenshot form
  const [screenshotForm, setScreenshotForm] = useState({
    title: "",
    content: "",
    style: "",
    category: "",
    tagsStr: "",
    useInContext: false,
  });
  const [screenshotFile, setScreenshotFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [addMode, setAddMode] = useState<"copy" | "screenshot">("copy");
  const [dragOver, setDragOver] = useState(false);

  const onDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && /^image\/(png|jpeg|jpg|webp|gif)$/i.test(file.type)) {
      setScreenshotFile(file);
    }
  }, []);

  const onDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  }, []);

  const onDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
  }, []);

  const fetchItems = useCallback(() => {
    setLoading(true);
    const params = new URLSearchParams({ brand: BRAND_ID });
    if (typeFilter) params.set("type", typeFilter);
    if (styleFilter) params.set("style", styleFilter);
    if (categoryFilter) params.set("category", categoryFilter);
    if (search) params.set("q", search);
    fetch(`/api/swipe-inspiration?${params}`)
      .then((r) => r.json())
      .then((d) => {
        setItems(d.items ?? []);
        if (d.styles) setStyles(d.styles);
        if (d.categories) setCategories(d.categories);
      })
      .catch(() => setItems([]))
      .finally(() => setLoading(false));
  }, [typeFilter, styleFilter, categoryFilter, search]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleAddCopy = (e: React.FormEvent) => {
    e.preventDefault();
    const tags = copyForm.tagsStr.split(/[\s,]+/).filter(Boolean);
    fetch("/api/swipe-inspiration", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        brand: BRAND_ID,
        type: "copy",
        title: copyForm.title || undefined,
        content: copyForm.content,
        style: copyForm.style || undefined,
        category: copyForm.category || undefined,
        tags: tags.length ? tags : undefined,
        useInContext: copyForm.useInContext,
      }),
    })
      .then((r) => r.json())
      .then(() => {
        setCopyForm({
          title: "",
          content: "",
          style: "",
          category: "",
          tagsStr: "",
          useInContext: false,
        });
        fetchItems();
        onChanged?.();
      });
  };

  const handleUploadScreenshot = (e: React.FormEvent) => {
    e.preventDefault();
    if (!screenshotFile) return;
    setUploading(true);
    const formData = new FormData();
    formData.set("brand", BRAND_ID);
    formData.set("image", screenshotFile);
    formData.set("title", screenshotForm.title);
    formData.set("content", screenshotForm.content);
    formData.set("style", screenshotForm.style);
    formData.set("category", screenshotForm.category);
    formData.set("tags", screenshotForm.tagsStr);
    formData.set("useInContext", String(screenshotForm.useInContext));

    fetch("/api/swipe-inspiration/upload", {
      method: "POST",
      body: formData,
    })
      .then((r) => r.json())
      .then(() => {
        setScreenshotFile(null);
        setScreenshotForm({
          title: "",
          content: "",
          style: "",
          category: "",
          tagsStr: "",
          useInContext: false,
        });
        fetchItems();
        onChanged?.();
      })
      .finally(() => setUploading(false));
  };

  const handleDelete = (id: string) => {
    if (!confirm("Remove this from your inspiration library?")) return;
    fetch(`/api/swipe-inspiration?brand=${BRAND_ID}&id=${id}`, {
      method: "DELETE",
    }).then((r) => {
      if (r.ok) {
        fetchItems();
        onChanged?.();
      }
    });
  };

  const handleAddToContext = (item: InspirationItem) => {
    fetch("/api/swipe-inspiration/add-to-context", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ brand: BRAND_ID, id: item.id }),
    })
      .then((r) => r.json())
      .then((d) => {
        if (d.ok) {
          onChanged?.();
          alert("Added to Swipe Files (context). You can use it in briefs and copywriter.");
        }
      });
  };

  const imageUrl = (item: InspirationItem) =>
    item.type === "image" && (item.imageFile || item.hasStoredImage)
      ? `/api/swipe-inspiration/image?brand=${BRAND_ID}&id=${item.id}`
      : null;

  return (
    <div>
      <h2 className="text-lg font-semibold mb-2">Inspiration Center</h2>
      <p className="text-sm text-muted mb-4">
        Your personal creative library: copywriting swipes, ad screenshots, and conversion inspiration. Search by style, add screenshots, and optionally add items to context for use in briefs.
      </p>

      {/* Filters */}
      <div className="flex flex-wrap gap-3 mb-4">
        <input
          type="text"
          placeholder="Search..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-surface min-w-[160px]"
        />
        <select
          value={typeFilter}
          onChange={(e) => setTypeFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-surface"
        >
          <option value="">All types</option>
          <option value="copy">Copy</option>
          <option value="image">Screenshot</option>
        </select>
        <select
          value={styleFilter}
          onChange={(e) => setStyleFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-surface"
        >
          <option value="">All styles</option>
          {styles.map((s) => (
            <option key={s.value} value={s.value}>
              {s.label}
            </option>
          ))}
        </select>
        <select
          value={categoryFilter}
          onChange={(e) => setCategoryFilter(e.target.value)}
          className="px-3 py-2 text-sm border border-border rounded-lg bg-surface"
        >
          <option value="">All categories</option>
          {categories.map((c) => (
            <option key={c.value} value={c.value}>
              {c.label}
            </option>
          ))}
        </select>
      </div>

      {/* Add new */}
      <div className="rounded-lg border border-border bg-surface p-5 mb-6">
        <div className="flex gap-2 mb-4">
          <button
            type="button"
            onClick={() => setAddMode("copy")}
            className={`px-3 py-1.5 text-sm rounded-lg ${addMode === "copy" ? "bg-accent text-white" : "bg-background border border-border"}`}
          >
            Add copy
          </button>
          <button
            type="button"
            onClick={() => setAddMode("screenshot")}
            className={`px-3 py-1.5 text-sm rounded-lg ${addMode === "screenshot" ? "bg-accent text-white" : "bg-background border border-border"}`}
          >
            Add screenshot
          </button>
        </div>

        {addMode === "copy" && (
          <form onSubmit={handleAddCopy} className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs text-muted mb-1">Title (optional)</label>
              <input
                type="text"
                value={copyForm.title}
                onChange={(e) =>
                  setCopyForm((f) => ({ ...f, title: e.target.value }))
                }
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
              />
            </div>
            <div className="sm:col-span-2">
              <label className="block text-xs text-muted mb-1">Content</label>
              <textarea
                value={copyForm.content}
                onChange={(e) =>
                  setCopyForm((f) => ({ ...f, content: e.target.value }))
                }
                rows={3}
                required
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background resize-y"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Style</label>
              <select
                value={copyForm.style}
                onChange={(e) =>
                  setCopyForm((f) => ({ ...f, style: e.target.value }))
                }
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
              >
                <option value="">—</option>
                {styles.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Category</label>
              <select
                value={copyForm.category}
                onChange={(e) =>
                  setCopyForm((f) => ({ ...f, category: e.target.value }))
                }
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
              >
                <option value="">—</option>
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Tags</label>
              <input
                type="text"
                value={copyForm.tagsStr}
                onChange={(e) =>
                  setCopyForm((f) => ({ ...f, tagsStr: e.target.value }))
                }
                placeholder="comma separated"
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
              />
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="copy-use-in-context"
                checked={copyForm.useInContext}
                onChange={(e) =>
                  setCopyForm((f) => ({ ...f, useInContext: e.target.checked }))
                }
                className="rounded border-border"
              />
              <label htmlFor="copy-use-in-context" className="text-xs text-muted">
                Use in context (for briefs)
              </label>
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:opacity-90"
              >
                Add to library
              </button>
            </div>
          </form>
        )}

        {addMode === "screenshot" && (
          <form onSubmit={handleUploadScreenshot} className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <label className="block text-xs text-muted mb-1">Screenshot (PNG, JPG, WEBP, GIF)</label>
              <div
                onDrop={onDrop}
                onDragOver={onDragOver}
                onDragLeave={onDragLeave}
                className={`border-2 border-dashed rounded-lg p-6 text-center text-sm transition-colors ${dragOver ? "border-accent bg-accent-light/30" : "border-border bg-muted/20"}`}
              >
                <input
                  type="file"
                  accept=".png,.jpg,.jpeg,.webp,.gif"
                  onChange={(e) => setScreenshotFile(e.target.files?.[0] ?? null)}
                  className="sr-only"
                  id="screenshot-file-input"
                />
                <label htmlFor="screenshot-file-input" className="cursor-pointer text-accent hover:underline">
                  {screenshotFile ? screenshotFile.name : "Drop a screenshot here or click to choose"}
                </label>
              </div>
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Title (optional)</label>
              <input
                type="text"
                value={screenshotForm.title}
                onChange={(e) =>
                  setScreenshotForm((f) => ({ ...f, title: e.target.value }))
                }
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Caption / notes</label>
              <input
                type="text"
                value={screenshotForm.content}
                onChange={(e) =>
                  setScreenshotForm((f) => ({ ...f, content: e.target.value }))
                }
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
              />
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Style</label>
              <select
                value={screenshotForm.style}
                onChange={(e) =>
                  setScreenshotForm((f) => ({ ...f, style: e.target.value }))
                }
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
              >
                <option value="">—</option>
                {styles.map((s) => (
                  <option key={s.value} value={s.value}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs text-muted mb-1">Category</label>
              <select
                value={screenshotForm.category}
                onChange={(e) =>
                  setScreenshotForm((f) => ({ ...f, category: e.target.value }))
                }
                className="w-full px-3 py-2 text-sm border border-border rounded-lg bg-background"
              >
                <option value="">—</option>
                {categories.map((c) => (
                  <option key={c.value} value={c.value}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
              <input
                type="checkbox"
                id="screenshot-use-in-context"
                checked={screenshotForm.useInContext}
                onChange={(e) =>
                  setScreenshotForm((f) => ({
                    ...f,
                    useInContext: e.target.checked,
                  }))
                }
                className="rounded border-border"
              />
              <label htmlFor="screenshot-use-in-context" className="text-xs text-muted">
                Use in context
              </label>
            </div>
            <div className="sm:col-span-2">
              <button
                type="submit"
                disabled={!screenshotFile || uploading}
                className="px-4 py-2 text-sm font-medium bg-accent text-white rounded-lg hover:opacity-90 disabled:opacity-50"
              >
                {uploading ? "Uploading…" : "Add screenshot"}
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Grid */}
      {loading ? (
        <p className="text-muted text-sm">Loading…</p>
      ) : items.length === 0 ? (
        <p className="text-muted text-sm">
          No items yet. Add copy or drop screenshots above.
        </p>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {items.map((item) => {
            const imgUrl = imageUrl(item);
            return (
              <div
                key={item.id}
                className="rounded-lg border border-border bg-surface overflow-hidden flex flex-col"
              >
                {imgUrl ? (
                  <div className="aspect-[4/3] bg-muted/30 flex items-center justify-center overflow-hidden">
                    <img
                      src={imgUrl}
                      alt={item.title || "Screenshot"}
                      className="object-contain max-h-full w-full"
                    />
                  </div>
                ) : (
                  <div className="p-3 border-b border-border min-h-[80px]">
                    <p className="text-sm text-muted line-clamp-3 whitespace-pre-wrap">
                      {item.content}
                    </p>
                  </div>
                )}
                <div className="p-3 flex-1 flex flex-col">
                  <div className="flex items-start justify-between gap-2 mb-1">
                    <span className="font-medium text-sm truncate">
                      {item.title || (item.type === "image" ? "Screenshot" : "Copy")}
                    </span>
                    <span className="text-xs text-muted shrink-0">
                      {new Date(item.addedAt).toLocaleDateString()}
                    </span>
                  </div>
                  <div className="flex flex-wrap gap-1 mb-2">
                    {item.style && (
                      <span className="text-xs px-2 py-0.5 bg-accent-light text-accent rounded-full">
                        {styles.find((s) => s.value === item.style)?.label ?? item.style}
                      </span>
                    )}
                    {item.category && (
                      <span className="text-xs px-2 py-0.5 bg-muted/50 rounded-full">
                        {categories.find((c) => c.value === item.category)?.label ?? item.category}
                      </span>
                    )}
                  </div>
                  {item.tags?.length ? (
                    <p className="text-xs text-muted mb-2">{item.tags.join(", ")}</p>
                  ) : null}
                  <div className="flex gap-2 mt-auto pt-2">
                    <button
                      type="button"
                      onClick={() => handleAddToContext(item)}
                      className="text-xs text-accent hover:underline"
                    >
                      Add to context
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(item.id)}
                      className="text-xs text-danger hover:underline"
                    >
                      Remove
                    </button>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
