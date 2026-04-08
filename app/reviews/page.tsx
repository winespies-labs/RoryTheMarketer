import ReviewsPanel from "./ReviewsPanel";

export default function ReviewsPage() {
  return (
    <div className="max-w-5xl">
      <h1 className="text-2xl font-semibold text-foreground mb-1">
        Customer reviews
      </h1>
      <p className="text-sm text-muted mb-6">
        Import from Slack, upload CSV/JSON, then search, star, and tag by topic.
        With{" "}
        <code className="text-xs bg-muted px-1 rounded">DATABASE_URL</code>,
        reviews are stored in Postgres; otherwise they use{" "}
        <code className="text-xs bg-muted px-1 rounded">data/winespies/reviews.json</code>
        .
      </p>
      <ReviewsPanel />
    </div>
  );
}
