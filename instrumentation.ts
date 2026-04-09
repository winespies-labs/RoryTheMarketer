export async function register() {
  if (process.env.NEXT_RUNTIME === "edge") return;
  const { startReviewsSlackCron } = await import("@/lib/reviews-slack-cron");
  startReviewsSlackCron();
  const { syncReferenceAdsFromDb } = await import("@/lib/reference-ads");
  await syncReferenceAdsFromDb();
}
