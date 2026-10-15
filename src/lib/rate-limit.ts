type Bucket = number[];

const buckets = new Map<string, Bucket>();

/** In-memory window. Swap for Upstash when UPSTASH_REDIS_REST_URL is set. */
export function rateLimit(key: string, limit: number, windowMs: number) {
  const now = Date.now();
  const recent = (buckets.get(key) ?? []).filter((stamp) => now - stamp < windowMs);
  if (recent.length >= limit) {
    buckets.set(key, recent);
    return { ok: false as const, retryAfterMs: windowMs - (now - recent[0]) };
  }
  recent.push(now);
  buckets.set(key, recent);
  return { ok: true as const };
}
