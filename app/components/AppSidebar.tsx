"use client";

import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { useState, useEffect } from "react";

interface NavItem {
  label: string;
  href: string;
}

interface NavGroup {
  label: string;
  items: NavItem[];
  /** Routes that should auto-expand this group */
  matchPrefixes: string[];
  /** Start expanded on initial load */
  defaultOpen?: boolean;
}

const NAV_GROUPS: NavGroup[] = [
  {
    label: "Context Hub",
    matchPrefixes: ["/context-hub"],
    defaultOpen: true,
    items: [
      { label: "Brand DNA", href: "/context-hub" },
      { label: "Strategy", href: "/context-hub" },
      { label: "Creative Ops", href: "/context-hub" },
    ],
  },
  {
    label: "Copywriting",
    matchPrefixes: ["/copywriting", "/swipes"],
    items: [
      { label: "Overview", href: "/copywriting" },
      { label: "Editor", href: "/copywriting/editor" },
      { label: "Library", href: "/copywriting/library" },
      { label: "Swipes", href: "/swipes" },
    ],
  },
  {
    label: "Creative",
    matchPrefixes: ["/creative", "/briefs"],
    items: [
      { label: "Overview", href: "/creative" },
      { label: "Briefs", href: "/briefs" },
      { label: "PDP Builder", href: "/creative/pdp" },
    ],
  },
  {
    label: "Ads Manager",
    matchPrefixes: ["/ads-manager"],
    items: [
      { label: "Campaigns", href: "/ads-manager" },
      { label: "Ad Sets", href: "/ads-manager/ad-sets" },
      { label: "Creatives", href: "/ads-manager/creatives" },
      { label: "Workshop", href: "/ads-manager/workshop" },
      { label: "Settings", href: "/ads-manager/settings" },
    ],
  },
];

const TOP_LINKS: NavItem[] = [
  { label: "Home", href: "/" },
  { label: "Reviews", href: "/reviews" },
  { label: "Testimonials", href: "/testimonials" },
];

const BOTTOM_LINKS: NavItem[] = [
  { label: "Chat", href: "/chat" },
];

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  return pathname === href || pathname.startsWith(href + "/");
}

function groupIsActive(pathname: string, group: NavGroup) {
  return group.matchPrefixes.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
}

function NavLink({ item, pathname }: { item: NavItem; pathname: string }) {
  const active = isActive(pathname, item.href);
  return (
    <Link
      href={item.href}
      className={`block px-3 py-1.5 rounded-md text-[13px] transition-colors ${
        active
          ? "bg-accent-light text-accent font-medium"
          : "text-muted hover:text-foreground hover:bg-background"
      }`}
    >
      {item.label}
    </Link>
  );
}

function CollapsibleGroup({
  group,
  pathname,
}: {
  group: NavGroup;
  pathname: string;
}) {
  const autoExpand = groupIsActive(pathname, group);
  const [open, setOpen] = useState(autoExpand || !!group.defaultOpen);

  useEffect(() => {
    if (autoExpand) setOpen(true);
  }, [autoExpand]);

  return (
    <div>
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-center justify-between px-3 py-1.5 text-[13px] font-medium text-foreground hover:bg-background rounded-md transition-colors"
      >
        {group.label}
        <svg
          className={`w-3.5 h-3.5 text-muted transition-transform ${open ? "rotate-90" : ""}`}
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={2}
        >
          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5l7 7-7 7" />
        </svg>
      </button>
      {open && (
        <div className="ml-2 mt-0.5 flex flex-col gap-0.5">
          {group.items.map((item) => (
            <NavLink key={item.label} item={item} pathname={pathname} />
          ))}
        </div>
      )}
    </div>
  );
}

export default function AppSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-[220px] shrink-0 bg-surface border-r border-border flex flex-col h-screen sticky top-0 overflow-y-auto">
      {/* Brand header */}
      <div className="px-4 h-14 flex items-center gap-2.5 border-b border-border shrink-0">
        <Image
          src="/logo.webp"
          alt="Rory"
          width={28}
          height={28}
          className="rounded object-contain"
        />
        <div className="leading-tight">
          <div className="font-semibold text-sm tracking-tight text-foreground">Rory</div>
          <div className="text-[10px] font-medium tracking-widest text-muted uppercase">Wine Spies</div>
        </div>
      </div>

      {/* Navigation */}
      <nav className="flex-1 px-2 py-3 flex flex-col gap-0.5">
        {TOP_LINKS.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}

        <div className="h-px bg-border my-2" />

        {NAV_GROUPS.map((group) => (
          <CollapsibleGroup key={group.label} group={group} pathname={pathname} />
        ))}

        <div className="h-px bg-border my-2" />

        {BOTTOM_LINKS.map((item) => (
          <NavLink key={item.href} item={item} pathname={pathname} />
        ))}
      </nav>
    </aside>
  );
}
