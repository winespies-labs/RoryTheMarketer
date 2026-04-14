import Link from "next/link";

export default function AdBuilderLanding() {
  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-semibold tracking-tight mb-1">Ad Builder</h1>
      <p className="text-muted mb-10">
        Two distinct tools. Choose the right one for your goal.
      </p>

      <div className="grid gap-6 sm:grid-cols-2">
        {/* PDP Feed Builder */}
        <Link
          href="/creative/pdp"
          className="group rounded-xl border border-border bg-surface p-7 hover:border-accent transition-colors flex flex-col gap-3"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
              <svg
                className="w-5 h-5 text-accent"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.75}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9 3H5a2 2 0 00-2 2v4m6-6h10a2 2 0 012 2v4M9 3v18m0 0h10a2 2 0 002-2V9M9 21H5a2 2 0 01-2-2V9m0 0h18"
                />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold group-hover:text-accent transition-colors">
                PDP Feed Builder
              </h2>
              <div className="text-xs text-muted font-medium mt-0.5">
                Scale production
              </div>
            </div>
          </div>
          <p className="text-sm text-muted leading-relaxed">
            Generate ads from today&apos;s live wine feed. Templates receive
            resolved feed fields — score badges, prices, and urgency signals are
            always feed-accurate.
          </p>
          <div className="mt-auto pt-2 flex flex-wrap gap-1.5">
            {["Multi-wine select", "Template validation", "Review Brief", "Batch generate"].map(
              (tag) => (
                <span
                  key={tag}
                  className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-background border border-border text-muted"
                >
                  {tag}
                </span>
              )
            )}
          </div>
        </Link>

        {/* Creative Ad Studio */}
        <Link
          href="/creative/ad-builder/studio"
          className="group rounded-xl border border-border bg-surface p-7 hover:border-accent transition-colors flex flex-col gap-3"
        >
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-accent/10 flex items-center justify-center shrink-0">
              <svg
                className="w-5 h-5 text-accent"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={1.75}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42"
                />
              </svg>
            </div>
            <div>
              <h2 className="font-semibold group-hover:text-accent transition-colors">
                Creative Ad Studio
              </h2>
              <div className="text-xs text-muted font-medium mt-0.5">
                Brand ads
              </div>
            </div>
          </div>
          <p className="text-sm text-muted leading-relaxed">
            Build new ad concepts across formats and styles. Testimonials,
            benefit ads, UGC, lifestyle — format first, wine optional.
          </p>
          <div className="mt-auto pt-2 flex flex-wrap gap-1.5">
            {["Testimonial", "Brand", "UGC", "Lifestyle"].map((tag) => (
              <span
                key={tag}
                className="text-[11px] font-medium px-2 py-0.5 rounded-full bg-background border border-border text-muted"
              >
                {tag}
              </span>
            ))}
          </div>
        </Link>
      </div>
    </div>
  );
}
