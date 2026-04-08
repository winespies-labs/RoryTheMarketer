import { BRANDS, getBrand } from "@/lib/brands";
import { runSlackReviewsSync } from "@/lib/reviews-slack-sync";

function msUntilNextUtc(hour: number, minute: number): number {
  const now = new Date();
  const next = new Date(
    Date.UTC(
      now.getUTCFullYear(),
      now.getUTCMonth(),
      now.getUTCDate(),
      hour,
      minute,
      0,
      0
    )
  );
  if (next.getTime() <= now.getTime()) {
    next.setUTCDate(next.getUTCDate() + 1);
  }
  return next.getTime() - now.getTime();
}

function parseHourUtc(): number {
  const raw = process.env.REVIEWS_SLACK_CRON_HOUR_UTC ?? "6";
  const n = Number.parseInt(raw, 10);
  if (Number.isNaN(n) || n < 0 || n > 23) return 6;
  return n;
}

/**
 * In-process daily Slack → reviews sync for long-lived `next start` (e.g. Railway).
 * Skips dev, skips unless SLACK_* env is set, unless ENABLE_REVIEWS_SLACK_CRON=false.
 * If you run multiple replicas, each runs the job (merge is idempotent by Slack ts).
 */
export function startReviewsSlackCron(): void {
  if (process.env.NODE_ENV !== "production") return;
  if (process.env.ENABLE_REVIEWS_SLACK_CRON === "false") return;
  if (!process.env.SLACK_BOT_TOKEN || !process.env.SLACK_REVIEWS_CHANNEL_ID) {
    return;
  }

  const brandId =
    process.env.REVIEWS_SLACK_CRON_BRAND?.trim() || BRANDS[0]?.id;
  const channelId = process.env.SLACK_REVIEWS_CHANNEL_ID;
  if (!brandId || !channelId || !getBrand(brandId)) {
    console.warn(
      "[reviews-slack-cron] invalid brand or channel; scheduler not started"
    );
    return;
  }

  const hourUtc = parseHourUtc();
  const minuteUtc = 0;

  const run = async () => {
    try {
      const result = await runSlackReviewsSync(brandId, channelId);
      console.log("[reviews-slack-cron] ok", {
        brand: brandId,
        ...result,
      });
    } catch (e) {
      console.error("[reviews-slack-cron] failed", e);
    }
  };

  const scheduleNext = () => {
    const ms = msUntilNextUtc(hourUtc, minuteUtc);
    setTimeout(() => {
      void run().finally(scheduleNext);
    }, ms);
  };

  console.log(
    `[reviews-slack-cron] scheduled daily at ${String(hourUtc).padStart(2, "0")}:00 UTC for brand ${brandId}`
  );
  scheduleNext();
}
