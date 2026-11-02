import { describe, expect, test } from "bun:test";
import { createHmac } from "node:crypto";
import { PageRateLimiter, RateLimitError } from "./rate-limit.ts";
import { parseSignedRequest } from "./signed-request.ts";

describe("PageRateLimiter", () => {
  test("allows calls up to the limit", () => {
    const limiter = new PageRateLimiter({ limit: 3, windowMs: 1000, now: () => 0 });

    limiter.tryAcquire("PAGE_1");
    limiter.tryAcquire("PAGE_1");
    limiter.tryAcquire("PAGE_1");

    expect(limiter.remaining("PAGE_1")).toBe(0);
  });

  test("throws once the budget is spent", () => {
    const limiter = new PageRateLimiter({ limit: 1, windowMs: 1000, now: () => 0 });
    limiter.tryAcquire("PAGE_1");

    expect(() => limiter.tryAcquire("PAGE_1")).toThrow(RateLimitError);
  });

  test("keeps a separate budget per page", () => {
    const limiter = new PageRateLimiter({ limit: 1, windowMs: 1000, now: () => 0 });
    limiter.tryAcquire("PAGE_1");

    expect(() => limiter.tryAcquire("PAGE_2")).not.toThrow();
    expect(limiter.remaining("PAGE_2")).toBe(0);
  });

  test("frees the budget once the window passes", () => {
    let now = 0;
    const limiter = new PageRateLimiter({ limit: 1, windowMs: 1000, now: () => now });
    limiter.tryAcquire("PAGE_1");

    now = 1500;

    expect(() => limiter.tryAcquire("PAGE_1")).not.toThrow();
  });

  test("reports how long to wait", () => {
    let now = 100;
    const limiter = new PageRateLimiter({ limit: 1, windowMs: 1000, now: () => now });
    limiter.tryAcquire("PAGE_1");
    now = 400;

    const error = (() => {
      try {
        limiter.tryAcquire("PAGE_1");
        return null;
      } catch (thrown) {
        return thrown as RateLimitError;
      }
    })();

    expect(error?.retryAfterMs).toBe(700);
  });

  test("reset clears one page or all of them", () => {
    const limiter = new PageRateLimiter({ limit: 1, windowMs: 1000, now: () => 0 });
    limiter.tryAcquire("PAGE_1");
    limiter.tryAcquire("PAGE_2");

    limiter.reset("PAGE_1");
    expect(() => limiter.tryAcquire("PAGE_1")).not.toThrow();

    limiter.reset();
    expect(() => limiter.tryAcquire("PAGE_2")).not.toThrow();
  });
});

describe("parseSignedRequest", () => {
  const secret = "app-secret";

  function sign(payload: Record<string, unknown>, key = secret): string {
    const encoded = Buffer.from(JSON.stringify(payload), "utf8").toString("base64url");
    const signature = createHmac("sha256", key).update(encoded).digest("base64url");

    return `${signature}.${encoded}`;
  }

  test("returns the payload when the signature matches", () => {
    const signed = sign({ algorithm: "HMAC-SHA256", user_id: "1234" });

    expect(parseSignedRequest(secret, signed)?.user_id).toBe("1234");
  });

  test("rejects a signature made with another secret", () => {
    const signed = sign({ user_id: "1234" }, "wrong");

    expect(parseSignedRequest(secret, signed)).toBeNull();
  });

  test("rejects a tampered payload", () => {
    const [signature] = sign({ user_id: "1234" }).split(".");
    const forged = Buffer.from(JSON.stringify({ user_id: "9999" }), "utf8").toString("base64url");

    expect(parseSignedRequest(secret, `${signature}.${forged}`)).toBeNull();
  });

  test("rejects a malformed value", () => {
    expect(parseSignedRequest(secret, "nonsense")).toBeNull();
    expect(parseSignedRequest(secret, "")).toBeNull();
  });

  test("rejects a payload that is not an object", () => {
    const encoded = Buffer.from("42", "utf8").toString("base64url");
    const signature = createHmac("sha256", secret).update(encoded).digest("base64url");

    expect(parseSignedRequest(secret, `${signature}.${encoded}`)).toBeNull();
  });
});
