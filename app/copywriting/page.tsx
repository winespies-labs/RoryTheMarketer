import Link from "next/link";

const sections = [
  {
    title: "Editor",
    description: "Write wine copy with live reading level, AI critique with actionable suggestions, and publish workflow.",
    href: "/copywriting/editor",
  },
  {
    title: "Library",
    description: "Browse and manage all published write-ups with scores and quick copy.",
    href: "/copywriting/library",
  },
  {
    title: "Swipes",
    description: "Browse, analyze, and drill on swipes from your library, technique drills, and extracted copy.",
    href: "/swipes",
  },
];

export default function CopywritingHub() {
  return (
    <div>
      <h1 className="text-2xl font-semibold tracking-tight mb-2">Copywriting</h1>
      <p className="text-muted mb-8">
        Write briefs, generate copy, and manage your swipe file — all powered by your brand context.
      </p>
      <div className="grid gap-4 sm:grid-cols-3">
        {sections.map((s) => (
          <Link
            key={s.href}
            href={s.href}
            className="group rounded-xl border border-border bg-surface p-6 hover:border-accent transition-colors"
          >
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
