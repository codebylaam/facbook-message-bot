import { describe, expect, test } from "bun:test";
import {
  ECHO_HUMAN_MODE_HOURS,
  echoHumanModeUntil,
  evaluateGuards,
  isInsideReplyWindow,
  REPLY_WINDOW_HOURS,
  shouldSwitchToHumanForEcho,
  windowExpiresAt,
} from "./guards.ts";

const NOW = new Date("2026-06-01T12:00:00Z");

function hoursAgo(hours: number): Date {
  return new Date(NOW.getTime() - hours * 60 * 60 * 1000);
}

function input(overrides: Partial<Parameters<typeof evaluateGuards>[0]> = {}) {
  return {
    botEnabled: true,
    mode: "bot" as const,
    lastCustomerMessageAt: hoursAgo(1),
    aiRepliesUsed: 0,
    aiRepliesLimit: 100,
    now: NOW,
    ...overrides,
  };
}

describe("evaluateGuards", () => {
  test("allows a healthy conversation", () => {
    expect(evaluateGuards(input())).toEqual({ allowed: true });
  });

  test("blocks when the bot is turned off", () => {
    const result = evaluateGuards(input({ botEnabled: false }));

    expect(result).toMatchObject({ allowed: false, reason: "bot_disabled" });
  });

  test("blocks when the conversation is in human mode", () => {
    const result = evaluateGuards(input({ mode: "human" }));

    expect(result).toMatchObject({ allowed: false, reason: "not_bot_mode" });
    expect(result.allowed === false && result.message).toContain("human");
  });

  test("blocks when the conversation is paused", () => {
    expect(evaluateGuards(input({ mode: "paused" }))).toMatchObject({ reason: "not_bot_mode" });
  });

  test("blocks when the quota is used up", () => {
    const result = evaluateGuards(input({ aiRepliesUsed: 100, aiRepliesLimit: 100 }));

    expect(result).toMatchObject({ allowed: false, reason: "quota_exhausted" });
  });

  test("still allows the last reply under the quota", () => {
    expect(evaluateGuards(input({ aiRepliesUsed: 99, aiRepliesLimit: 100 }))).toEqual({
      allowed: true,
    });
  });

  test("blocks outside the 24 hour window", () => {
    const result = evaluateGuards(input({ lastCustomerMessageAt: hoursAgo(25) }));

    expect(result).toMatchObject({ allowed: false, reason: "outside_window" });
  });

  test("allows just inside the window", () => {
    expect(
      evaluateGuards(input({ lastCustomerMessageAt: hoursAgo(REPLY_WINDOW_HOURS - 0.5) })),
    ).toEqual({ allowed: true });
  });

  test("blocks when the customer never wrote", () => {
    expect(evaluateGuards(input({ lastCustomerMessageAt: null }))).toMatchObject({
      reason: "outside_window",
    });
  });

  test("reports the quota that was hit", () => {
    const result = evaluateGuards(input({ aiRepliesUsed: 5, aiRepliesLimit: 5 }));

    expect(result.allowed === false && result.message).toContain("5 AI replies");
  });
});

describe("reply window", () => {
  test("expires 24 hours after the customer's message", () => {
    expect(windowExpiresAt(hoursAgo(0))?.toISOString()).toBe("2026-06-02T12:00:00.000Z");
  });

  test("has no window without a customer message", () => {
    expect(windowExpiresAt(null)).toBeNull();
    expect(isInsideReplyWindow(null, NOW)).toBe(false);
  });

  test("treats exactly 24 hours as expired", () => {
    expect(isInsideReplyWindow(hoursAgo(REPLY_WINDOW_HOURS), NOW)).toBe(true);
    expect(isInsideReplyWindow(hoursAgo(REPLY_WINDOW_HOURS + 0.01), NOW)).toBe(false);
  });
});

describe("echo handling", () => {
  test("switches a bot conversation to human for four hours", () => {
    expect(ECHO_HUMAN_MODE_HOURS).toBe(4);
    expect(echoHumanModeUntil(NOW).toISOString()).toBe("2026-06-01T16:00:00.000Z");
  });

  test("only changes a conversation that the bot owns", () => {
    expect(shouldSwitchToHumanForEcho("bot")).toBe(true);
    expect(shouldSwitchToHumanForEcho("human")).toBe(false);
    expect(shouldSwitchToHumanForEcho("paused")).toBe(false);
  });
});
