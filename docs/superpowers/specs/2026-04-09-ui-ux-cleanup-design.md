# UI/UX Cleanup — Design Spec
**Date:** 2026-04-09
**Scope:** Targeted — three specific changes, no collateral refactoring

---

## 1. Sidebar Navigation

**File:** `app/components/AppSidebar.tsx`

### Changes
- Add a small icon prefix to each group label and top/bottom link:
  - Home → `🏠 Home`
  - Reviews → `⭐ Reviews`
  - Context Hub → `📚 Context Hub`
  - Copywriting → `✏️ Copywriting`
  - Creative → `🎨 Creative`
  - Ads Manager → `📊 Ads Manager`
  - Chat → `💬 Chat`
- Remove the three Context Hub sub-items (`Brand DNA`, `Strategy`, `Creative Ops`) — they all resolve to `/context-hub` anyway; the internal sidebar within that page handles section navigation.
- Remove the `Overview` sub-item from the Copywriting group (`href: "/copywriting"`) — the group header itself becomes the link to the overview.
- Remove the `Overview` sub-item from the Creative group (`href: "/creative"`) — same reason.
- Make collapsible group header labels clickable `<Link>` elements while keeping the chevron `<button>` as the toggle target. Currently the entire `<button>` wraps both label and chevron — split these so the label navigates and the chevron toggles. Each group already has a primary route (first item's `href`) to use as the link target.

### Not changing
- Collapsible behavior and auto-expand logic stays as-is
- Active state styling stays as-is
- `TOP_LINKS` / `BOTTOM_LINKS` / `NAV_GROUPS` data structure stays as-is (just update content)

---

## 2. Page Layout — Sticky Top Bar

**Files:** `app/components/LayoutShell.tsx`, new `app/components/TopBar.tsx`

### Change
Add a sticky top bar to the main content area that shows:
- Current page/section name (derived from the pathname)
- Optional breadcrumb when on a sub-page (e.g. `Copywriting › Editor`)

The top bar sits inside `<main>` at the top, below the sidebar header, above page content. It is `sticky top-0 z-10` so it stays visible on scroll.

### TopBar component
- Reads `usePathname()` to determine the current route
- Maps pathnames to human-readable labels and optional parent breadcrumbs using a static lookup table
- Renders: `[parent label ›] [page label]` in a slim bar (`h-11`) with `bg-surface border-b border-border`
- No action buttons in the bar for now (can be added per-page later via a slot/portal pattern, but not in this cleanup)

### LayoutShell update
- Current `<main>` renders `px-8 py-8 {children}` directly
- After: wraps children in a flex-col container with `<TopBar />` at top, then `<div className="px-8 py-6">{children}</div>` below
- Remove `py-8` from `<main>` (top padding now comes from the bar + content padding)

### Existing page headers
- Pages that currently render an inline `<h1>` + description (e.g. `reviews/page.tsx`, `app/page.tsx`) keep their h1 — the top bar is additional context, not a replacement. The h1 can be removed from individual pages as a follow-on cleanup but is out of scope here.

---

## 3. Home Page Polish

**File:** `app/page.tsx`

### Changes
- Add an icon to each of the 4 nav cards matching the sidebar icon set:
  - Context Hub → `📚`
  - Copywriting → `✏️`
  - Creative → `🎨`
  - Chat → `💬`
- Display the icon large (`text-3xl`) at the top of each card, above the title
- Tighten the page header: reduce `py-12` to `py-8`, reduce `mb-10` to `mb-6`
- No layout changes — keep the 4-column grid

---

## Out of Scope
- Button style normalization across all pages
- Input/form consistency sweep
- Mobile/responsive improvements
- New dashboard widgets or stats on the home page
- Removing existing inline page `<h1>` headers (that's a follow-on)
