import { createMiddleware } from "hono/factory";
import { HTTPException } from "hono/http-exception";
import type { AppEnv } from "./auth.ts";

export type RateLimitOptions = {
  limit: number;
  windowMs: number;
  /** Requests with no session are keyed by address instead. */
  keyFor?: (c: Parameters<Parameters<typeof createMiddleware<AppEnv>>[0]>[0]) => string;
};

/**
 * A sliding window per caller. In memory, so it counts per API process; behind
 * several replicas each would keep its own window.
 */
export function rateLimit(options: RateLimitOptions) {
  const hits = new Map<string, number[]>();
  const { limit, windowMs } = options;

  return createMiddleware<AppEnv>(async (c, next) => {
    const key =
      options.keyFor?.(c) ??
      c.get("user")?.id ??
      c.req.header("x-forwarded-for")?.split(",")[0]?.trim() ??
      c.req.header("cf-connecting-ip") ??
      "anonymous";

    const now = Date.now();
    const recent = (hits.get(key) ?? []).filter((timestamp) => now - timestamp < windowMs);

    if (recent.length >= limit) {
      const oldest = recent[0] ?? now;
      c.header("Retry-After", String(Math.ceil((windowMs - (now - oldest)) / 1000)));

      throw new HTTPException(429, { message: "Too many requests, slow down a little" });
    }

    recent.push(now);
    hits.set(key, recent);

    // Keeps the map from growing with one-off keys.
    if (hits.size > 10_000) {
      for (const [candidate, timestamps] of hits) {
        if (timestamps.every((timestamp) => now - timestamp >= windowMs)) {
          hits.delete(candidate);
        }
      }
    }

    await next();
  });
}
