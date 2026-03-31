import Link from "next/link";

export default function HomePage() {
  return (
    <div className="py-12">
      <h1 className="text-3xl font-semibold tracking-tight mb-2">
        Rory the Marketer
      </h1>
      <p className="text-muted text-lg mb-10 max-w-xl">
        Your marketing ops hub. Write briefs, get copy assistance, and manage brand context all in one place.
      </p>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Link
          href="/context-hub"
          className="group rounded-xl border border-border bg-surface p-6 hover:border-accent transition-colors"
        >
          <h2 className="font-semibold mb-1 group-hover:text-accent transition-colors">
            Context Hub
          </h2>
          <p className="text-sm text-muted">
            Brand voice, personas, swipe files, and reference material.
          </p>
        </Link>

        <Link
          href="/copywriting"
          className="group rounded-xl border border-border bg-surface p-6 hover:border-accent transition-colors"
        >
          <h2 className="font-semibold mb-1 group-hover:text-accent transition-colors">
            Copywriting
          </h2>
          <p className="text-sm text-muted">
            Briefs, copy generation, and swipe inspiration.
          </p>
        </Link>

        <Link
          href="/creative"
          className="group rounded-xl border border-border bg-surface p-6 hover:border-accent transition-colors"
        >
          <h2 className="font-semibold mb-1 group-hover:text-accent transition-colors">
            Creative
          </h2>
          <p className="text-sm text-muted">
            Ad builder, wines, IG research, and ads manager.
          </p>
        </Link>

        <Link
          href="/chat"
          className="group rounded-xl border border-border bg-surface p-6 hover:border-accent transition-colors"
        >
          <h2 className="font-semibold mb-1 group-hover:text-accent transition-colors">
            Chat
          </h2>
          <p className="text-sm text-muted">
            Talk to Rory about your brand, strategy, and campaigns.
          </p>
        </Link>
      </div>
    </div>
  );
}
