import Link from "next/link";

const sections = [
  {
    title: "PDP Builder",
    description: "Generate ads from today's live wine feed. Scale production with feed-accurate templates.",
    href: "/creative/pdp",
    badge: "New",
  },
  {
    title: "Ad Studio",
    description: "Build brand ads — USPs, testimonials, lifestyle, offers. Pick a style, configure copy, generate with Gemini.",
    href: "/creative/ad-builder/studio",
    badge: "New",
  },
  {
    title: "Briefs",
    description: "Generate ad creative briefs with brand context and persona targeting.",
    href: "/briefs",
    badge: null,
  },
];

export default function CreativeHub() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight mb-2">Creative</h1>
      <p className="text-muted mb-8">
        Build ads and research creative — all in one place.
      </p>
      <div className="grid gap-4 sm:grid-cols-2">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="group rounded-xl border border-border bg-surface p-6 hover:border-accent transition-colors relative"
          >
            {s.badge && (
              <span className="absolute top-4 right-4 text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded bg-accent text-white">
                {s.badge}
              </span>
            )}
            <h2 className="font-semibold mb-1 group-hover:text-accent transition-colors">
              {s.title}
            </h2>
            <p className="text-sm text-muted">{s.description}</p>
          </Link>
        ))}
      </div>
    </div>
  );
}
