import { describe, expect, test } from "bun:test";
import type { ChatResult, LlmClient } from "../llm-types.ts";
import {
  detectLanguage,
  fallbackRewrite,
  rewriteQuery,
  rewriteQueryWithFallback,
} from "./query-rewrite.ts";

function stubLlm(content: string | (() => never)): LlmClient {
  return {
    chat: async (): Promise<ChatResult> => {
      if (typeof content === "function") {
        content();
        throw new Error("unreachable");
      }

      return { content, model: "test", usage: {} };
    },
  };
}

describe("detectLanguage", () => {
  test("detects Bangla script", () => {
    expect(detectLanguage("এই শার্টের দাম কত?")).toBe("bn");
  });

  test("detects Banglish", () => {
    expect(detectLanguage("ei shirt er dam koto?")).toBe("banglish");
    expect(detectLanguage("size L ache?")).toBe("banglish");
  });

  test("defaults to English", () => {
    expect(detectLanguage("What is the price of this shirt?")).toBe("en");
  });
});

describe("rewriteQuery", () => {
  test("returns the rewritten query, intent and language", async () => {
    const llm = stubLlm(
      JSON.stringify({
        query: "shirt price size L stock দাম",
        intent: "pricing",
        language: "banglish",
      }),
    );

    const rewrite = await rewriteQuery(llm, { message: "ei shirt er dam koto, L size ache?" });

    expect(rewrite.query).toBe("shirt price size L stock দাম");
    expect(rewrite.intent).toBe("pricing");
    expect(rewrite.language).toBe("banglish");
  });

  test("accepts a fenced response", async () => {
    const llm = stubLlm(
      '```json\n{"query":"delivery charge","intent":"delivery","language":"en"}\n```',
    );

    expect((await rewriteQuery(llm, { message: "delivery koto?" })).intent).toBe("delivery");
  });

  test("falls back to the raw message when the query is empty", async () => {
    const llm = stubLlm('{"query":"","intent":"pricing","language":"en"}');

    expect((await rewriteQuery(llm, { message: "dam koto" })).query).toBe("dam koto");
  });

  test("falls back to other for an unknown intent", async () => {
    const llm = stubLlm('{"query":"x","intent":"nonsense","language":"en"}');

    expect((await rewriteQuery(llm, { message: "x" })).intent).toBe("other");
  });

  test("throws on malformed json so the caller can fall back", async () => {
    await expect(rewriteQuery(stubLlm("not json"), { message: "hi" })).rejects.toThrow();
  });
});

describe("rewriteQueryWithFallback", () => {
  test("uses the model when it answers", async () => {
    const llm = stubLlm('{"query":"shirt price","intent":"pricing","language":"en"}');

    expect((await rewriteQueryWithFallback(llm, { message: "shirt?" })).query).toBe("shirt price");
  });

  test("searches with the raw message when the model fails", async () => {
    const llm = stubLlm("I cannot help");

    const rewrite = await rewriteQueryWithFallback(llm, { message: "ei shirt er dam koto" });

    expect(rewrite.query).toBe("ei shirt er dam koto");
    expect(rewrite.language).toBe("banglish");
    expect(rewrite.intent).toBe("other");
  });
});

describe("fallbackRewrite", () => {
  test("keeps the message and detects the script", () => {
    expect(fallbackRewrite("ডেলিভারি চার্জ কত?")).toEqual({
      query: "ডেলিভারি চার্জ কত?",
      intent: "other",
      language: "bn",
    });
  });
});
