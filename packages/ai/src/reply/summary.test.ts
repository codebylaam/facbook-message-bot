import { describe, expect, test } from "bun:test";
import type { ChatResult, LlmClient } from "../llm-types.ts";
import { SUMMARY_EVERY_MESSAGES, shouldRefreshSummary, summarizeConversation } from "./summary.ts";

function stubLlm(content: string): LlmClient {
  return {
    chat: async (): Promise<ChatResult> => ({ content, model: "test", usage: {} }),
  };
}

describe("shouldRefreshSummary", () => {
  test("refreshes every twenty messages", () => {
    expect(SUMMARY_EVERY_MESSAGES).toBe(20);
    expect(shouldRefreshSummary(20)).toBe(true);
    expect(shouldRefreshSummary(40)).toBe(true);
  });

  test("does not refresh in between", () => {
    expect(shouldRefreshSummary(0)).toBe(false);
    expect(shouldRefreshSummary(19)).toBe(false);
    expect(shouldRefreshSummary(21)).toBe(false);
  });
});

describe("summarizeConversation", () => {
  test("returns the summary", async () => {
    const summary = await summarizeConversation(
      stubLlm('{"summary":"Karim wants a cotton shirt in L."}'),
      {
        pageName: "Dhaka Threads",
        history: [
          { role: "customer", text: "shirt ache?" },
          { role: "bot", text: "জি আছে।" },
        ],
      },
    );

    expect(summary).toBe("Karim wants a cotton shirt in L.");
  });

  test("accepts a fenced response", async () => {
    const summary = await summarizeConversation(
      stubLlm('```json\n{"summary":"Short talk."}\n```'),
      {
        pageName: "Shop",
        history: [],
      },
    );

    expect(summary).toBe("Short talk.");
  });

  test("throws when the model returns no summary", async () => {
    await expect(
      summarizeConversation(stubLlm('{"summary":"   "}'), { pageName: "Shop", history: [] }),
    ).rejects.toThrow(/no summary/);
  });

  test("throws on malformed json", async () => {
    await expect(
      summarizeConversation(stubLlm("not json"), { pageName: "Shop", history: [] }),
    ).rejects.toThrow();
  });
});
