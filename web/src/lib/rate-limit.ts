/**
 * Simple in-memory sliding window rate limiter (per process).
 * Suitable for MVP / single-node; serverless instances each keep their own counters.
 */

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();

export interface RateLimitRule {
  windowMs: number;
  maxRequests: number;
}

export function checkRateLimit(
  key: string,
  rule: RateLimitRule,
  nowMs: number = Date.now(),
): { ok: true } | { ok: false; retryAfterMs: number } {
  const bucket = buckets.get(key) ?? { timestamps: [] };
  const cutoff = nowMs - rule.windowMs;
  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);
  if (bucket.timestamps.length >= rule.maxRequests) {
    const oldest = bucket.timestamps[0] ?? nowMs;
    const retryAfterMs = Math.max(0, oldest + rule.windowMs - nowMs);
    buckets.set(key, bucket);
    return { ok: false, retryAfterMs };
  }
  bucket.timestamps.push(nowMs);
  buckets.set(key, bucket);
  return { ok: true };
}

/** Defaults documented in repository root `web-spec/AUTH_AND_LIMITS.md`. */
export const RETRIEVE_RATE_LIMIT: RateLimitRule = {
  windowMs: 60 * 60 * 1000,
  maxRequests: 120,
};
