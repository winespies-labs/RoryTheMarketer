import TestimonialsPanel from "./TestimonialsPanel";

export default function TestimonialsPage() {
  return (
    <div className="max-w-6xl">
      <h1 className="text-2xl font-semibold text-foreground mb-1">
        Testimonials
      </h1>
      <p className="text-sm text-muted mb-6">
        Customer reviews scored for ad-readiness, categorized by USP, and extracted for use in copy and ads. Syncs daily from Slack.
      </p>
      <TestimonialsPanel />
    </div>
  );
}
