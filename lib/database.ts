/** When set, swipe/context library persistence uses PostgreSQL (e.g. Railway) instead of local JSON files. */
export function useDatabase(): boolean {
  return Boolean(process.env.DATABASE_URL?.trim());
}
