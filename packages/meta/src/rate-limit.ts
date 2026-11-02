export class RateLimitError extends Error {
  readonly retryAfterMs: number;

  constructor(message: string, retryAfterMs: number) {
    super(message);
    this.name = "RateLimitError";
    this.retryAfterMs = retryAfterMs;
  }
}

export type RateLimiterOptions = {
  limit: number;
  windowMs: number;
  now?: () => number;
};

/**
 * A sliding window per Page. Meta's limits are per Page, so one busy shop must not
 * spend another shop's budget. This lives in the process, which is correct while a
 * single worker runs; several workers would each hold their own window.
 */
export class PageRateLimiter {
  private readonly hits = new Map<string, number[]>();
  private readonly limit: number;
  private readonly windowMs: number;
  private readonly now: () => number;

  constructor(options: RateLimiterOptions) {
    this.limit = options.limit;
    this.windowMs = options.windowMs;
    this.now = options.now ?? Date.now;
  }

  private recent(pageId: string): number[] {
    const now = this.now();
    const kept = (this.hits.get(pageId) ?? []).filter(
      (timestamp) => now - timestamp < this.windowMs,
    );

    this.hits.set(pageId, kept);

    return kept;
  }

  tryAcquire(pageId: string): void {
    const recent = this.recent(pageId);

    if (recent.length >= this.limit) {
      const oldest = recent[0] ?? this.now();
      const retryAfterMs = Math.max(0, this.windowMs - (this.now() - oldest));

      throw new RateLimitError(
        `The Page has used ${this.limit} Graph calls in the last ${Math.round(this.windowMs / 1000)} seconds`,
        retryAfterMs,
      );
    }

    recent.push(this.now());
  }

  remaining(pageId: string): number {
    return Math.max(0, this.limit - this.recent(pageId).length);
  }

  reset(pageId?: string): void {
    if (pageId) {
      this.hits.delete(pageId);
      return;
    }

    this.hits.clear();
  }
}
