import Link from "next/link";

export default function CreativeStudio() {
  return (
    <div className="flex flex-col items-center justify-center min-h-[50vh] text-center gap-4">
      <div className="w-14 h-14 rounded-2xl bg-accent/10 flex items-center justify-center">
        <svg
          className="w-7 h-7 text-accent"
          fill="none"
          viewBox="0 0 24 24"
          stroke="currentColor"
          strokeWidth={1.5}
        >
          <path
            strokeLinecap="round"
            strokeLinejoin="round"
            d="M9.53 16.122a3 3 0 00-5.78 1.128 2.25 2.25 0 01-2.4 2.245 4.5 4.5 0 008.4-2.245c0-.399-.078-.78-.22-1.128zm0 0a15.998 15.998 0 003.388-1.62m-5.043-.025a15.994 15.994 0 011.622-3.395m3.42 3.42a15.995 15.995 0 004.764-4.648l3.876-5.814a1.151 1.151 0 00-1.597-1.597L14.146 6.32a15.996 15.996 0 00-4.649 4.763m3.42 3.42a6.776 6.776 0 00-3.42-3.42"
          />
        </svg>
      </div>
      <div>
        <h1 className="text-xl font-semibold tracking-tight">Creative Ad Studio</h1>
        <p className="text-muted mt-1 text-sm max-w-xs mx-auto">
          Build new ad concepts — testimonials, benefits, UGC, lifestyle.
          Coming soon.
        </p>
      </div>
      <Link
        href="/creative/ad-builder"
        className="text-sm text-accent hover:underline mt-2"
      >
        Back to Ad Builder
      </Link>
    </div>
  );
}
