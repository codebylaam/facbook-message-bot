import { describe, expect, test } from "bun:test";
import {
  COMMENT_KINDS,
  classifyComment,
  classifyCommentWithFallback,
  isAnswerable,
  PUBLIC_REPLY_TEXT,
} from "./comment-classify.ts";
import type { ChatResult, LlmClient } from "./llm-types.ts";

function stubLlm(content: string | (() => never)): LlmClient {
  return {
    chat: async (): Promise<ChatResult> => {
      if (typeof content === "function") {
        content();
      }

      return { content: typeof content === "string" ? content : "", model: "test", usage: {} };
    },
  };
}

describe("classifyComment", () => {
  test("returns the kind and confidence", async () => {
    const result = await classifyComment(stubLlm('{"kind":"price_question","confidence":0.93}'), {
      text: "ei shirt er dam koto?",
    });

    expect(result).toEqual({ kind: "price_question", confidence: 0.93 });
  });

  test("accepts a fenced response", async () => {
    const result = await classifyComment(
      stubLlm('```json\n{"kind":"order_intent","confidence":0.8}\n```'),
      { text: "ami nite chai" },
    );

    expect(result.kind).toBe("order_intent");
  });

  test("falls back to other for an unknown kind", async () => {
    const result = await classifyComment(stubLlm('{"kind":"haggling","confidence":0.9}'), {
      text: "x",
    });

    expect(result.kind).toBe("other");
  });

  test("falls back to other when the body is not json", async () => {
    const result = await classifyComment(stubLlm("this is a complaint"), { text: "x" });

    expect(result).toEqual({ kind: "other", confidence: 0 });
  });

  test("falls back to other when confidence is unreadable", async () => {
    const result = await classifyComment(stubLlm('{"kind":"spam","confidence":"sure"}'), {
      text: "x",
    });

    expect(result.confidence).toBe(0);
  });

  test("handles every documented kind", async () => {
    for (const kind of COMMENT_KINDS) {
      const result = await classifyComment(stubLlm(JSON.stringify({ kind, confidence: 1 })), {
        text: "x",
      });

      expect(result.kind).toBe(kind);
    }
  });
});

describe("classifyCommentWithFallback", () => {
  test("uses the model when it answers", async () => {
    const result = await classifyCommentWithFallback(
      stubLlm('{"kind":"complaint","confidence":0.7}'),
      { text: "product ta noshto" },
    );

    expect(result.kind).toBe("complaint");
  });

  test("does not throw when the model call fails", async () => {
    const result = await classifyCommentWithFallback(
      stubLlm(() => {
        throw new Error("model down");
      }),
      { text: "product ta noshto" },
    );

    expect(result).toEqual({ kind: "other", confidence: 0 });
  });
});

describe("isAnswerable", () => {
  test("answers questions and orders", () => {
    expect(isAnswerable("price_question")).toBe(true);
    expect(isAnswerable("order_intent")).toBe(true);
  });

  test("leaves complaints, spam and small talk alone", () => {
    expect(isAnswerable("complaint")).toBe(false);
    expect(isAnswerable("spam")).toBe(false);
    expect(isAnswerable("other")).toBe(false);
  });
});

describe("PUBLIC_REPLY_TEXT", () => {
  test("is a short Bangla line pointing at the inbox", () => {
    expect(PUBLIC_REPLY_TEXT).toContain("ইনবক্স");
  });
});
