import { describe, expect, test } from "bun:test";
import type { ChatResult, LlmClient } from "../llm-types.ts";
import { runReplyEngine } from "./engine.ts";
import type { ReplyKnowledge, RetrievedChunk } from "./types.ts";

const KNOWLEDGE: ReplyKnowledge = {
  pageName: "Dhaka Threads",
  persona: { name: "Rumi", tone: "warm" },
  profileLines: ["About: Handmade clothing"],
  policies: [{ title: "Delivery", content: "ঢাকার ভিতরে ৬০ টাকা।" }],
};

const CHUNK: RetrievedChunk = {
  id: "chunk-1",
  content: "Cotton Shirt. Price: 1200.00 BDT",
  sourceType: "product",
  sourceId: "p-1",
  score: 0.03,
  vectorRank: 1,
  textRank: 1,
  trigramRank: null,
};

/** Answers the rewrite call first, then the generation call. */
function scriptedLlm(rewrite: string, generate: string | (() => never)): LlmClient {
  let call = 0;

  return {
    chat: async (): Promise<ChatResult> => {
      call += 1;

      if (call === 1) {
        return { content: rewrite, model: "test", usage: { totalTokens: 30 } };
      }

      if (typeof generate === "function") {
        generate();
        throw new Error("unreachable");
      }

      return { content: generate, model: "test", usage: { totalTokens: 120 } };
    },
  };
}

const REWRITE = '{"query":"shirt price","intent":"pricing","language":"banglish"}';

const ANSWER = JSON.stringify({
  reply: "Shirt er dam 1200 taka.",
  confidence: 0.9,
  needs_human: false,
  handoff_reason: null,
  intent: "pricing",
  source_ids: ["chunk-1"],
  lead: null,
});

function engine(overrides: Partial<Parameters<typeof runReplyEngine>[0]> = {}) {
  return runReplyEngine({
    llm: scriptedLlm(REWRITE, ANSWER),
    knowledge: KNOWLEDGE,
    retrieve: async () => [CHUNK],
    message: "ei shirt er dam koto?",
    confidenceThreshold: 0.7,
    ...overrides,
  });
}

describe("runReplyEngine", () => {
  test("answers a question it can support", async () => {
    const result = await engine();

    expect(result.rewrite.query).toBe("shirt price");
    expect(result.retrieved).toHaveLength(1);
    expect(result.decision).toEqual({ action: "send", reply: "Shirt er dam 1200 taka." });
    expect(result.generationError).toBeNull();
  });

  test("searches with the rewritten query", async () => {
    const seen: string[] = [];

    await engine({
      retrieve: async (query) => {
        seen.push(query);
        return [CHUNK];
      },
    });

    expect(seen).toEqual(["shirt price"]);
  });

  test("reports the token usage of the generation call", async () => {
    const result = await engine();

    expect(result.usage.totalTokens).toBe(120);
  });

  test("hands off when the model fails instead of losing the customer", async () => {
    const result = await engine({
      llm: scriptedLlm(REWRITE, () => {
        throw new Error("model unavailable");
      }),
    });

    expect(result.output).toBeNull();
    expect(result.decision.action).toBe("handoff");
    expect(result.decision).toMatchObject({
      reason: "The reply model failed: model unavailable",
      draft: "",
    });
    expect(result.generationError).toBe("model unavailable");
  });

  test("still retrieves when the generation fails", async () => {
    const result = await engine({
      llm: scriptedLlm(REWRITE, () => {
        throw new Error("boom");
      }),
    });

    expect(result.retrieved).toHaveLength(1);
  });

  test("hands off when the model returns unparseable json", async () => {
    const result = await engine({ llm: scriptedLlm(REWRITE, "the price is 1200") });

    expect(result.decision.action).toBe("handoff");
    expect(result.generationError).toContain("valid JSON");
  });

  test("keeps working when the rewrite call fails", async () => {
    const result = await engine({
      llm: scriptedLlm("not json at all", ANSWER),
      message: "শার্টের দাম কত?",
    });

    expect(result.rewrite.query).toBe("শার্টের দাম কত?");
    expect(result.rewrite.language).toBe("bn");
    expect(result.decision.action).toBe("send");
  });

  test("hands off below the confidence threshold", async () => {
    const result = await engine({
      llm: scriptedLlm(REWRITE, ANSWER.replace("0.9", "0.4")),
      confidenceThreshold: 0.7,
    });

    expect(result.decision.action).toBe("handoff");
  });

  test("sends when the threshold is lowered", async () => {
    const result = await engine({
      llm: scriptedLlm(REWRITE, ANSWER.replace("0.9", "0.4")),
      confidenceThreshold: 0.3,
    });

    expect(result.decision.action).toBe("send");
  });

  test("hands off an order", async () => {
    const result = await engine({
      llm: scriptedLlm(
        REWRITE,
        ANSWER.replace(
          '"lead":null',
          '"lead":{"name":"Karim","phone":"01700000000","address":null,"items":[{"name":"Cotton Shirt","quantity":2,"variant":"L"}]}',
        ),
      ),
    });

    expect(result.decision.action).toBe("handoff");
  });

  test("keeps collecting while an order has no way to reach the customer", async () => {
    const result = await engine({
      llm: scriptedLlm(
        REWRITE,
        ANSWER.replace(
          '"lead":null',
          '"lead":{"name":null,"phone":null,"address":null,"items":[{"name":"Cotton Shirt","quantity":2,"variant":"L"}]}',
        ),
      ),
    });

    expect(result.decision.action).toBe("send");
  });

  test("passes the conversation summary and history to the model", async () => {
    const prompts: string[] = [];
    let call = 0;

    const llm: LlmClient = {
      chat: async (messages) => {
        call += 1;
        prompts.push(messages.map((message) => message.content).join("\n"));

        return {
          content: call === 1 ? REWRITE : ANSWER,
          model: "test",
          usage: {},
        };
      },
    };

    await engine({
      llm,
      summary: "They are looking for a large shirt.",
      history: [
        { role: "customer", text: "shirt ache?" },
        { role: "bot", text: "জি আছে।" },
      ],
    });

    expect(prompts[1]).toContain("They are looking for a large shirt.");
    expect(prompts[1]).toContain("customer: shirt ache?");
  });

  test("lets a retrieval failure surface so the caller can retry", async () => {
    await expect(
      engine({
        retrieve: async () => {
          throw new Error("database down");
        },
      }),
    ).rejects.toThrow(/database down/);
  });
  test("regenerates once when a Latin-script customer gets Bangla script", async () => {
    const mixed = ANSWER.replace("Shirt er dam 1200 taka.", "Shirt er dam ১২০০ টাকা.");
    const prompts: string[] = [];
    const replies = [REWRITE, mixed, ANSWER];

    const llm: LlmClient = {
      chat: async (messages) => {
        prompts.push(messages.map((message) => message.content).join("\n"));
        return { content: replies.shift() ?? ANSWER, model: "test", usage: { totalTokens: 100 } };
      },
    };

    const result = await engine({ llm });

    expect(prompts).toHaveLength(3);
    expect(prompts[2]).toContain("mixed in Bangla script");
    expect(result.decision).toEqual({ action: "send", reply: "Shirt er dam 1200 taka." });
    expect(result.usage.totalTokens).toBe(200);
  });

  test("does not regenerate a Bangla reply to a Bangla customer", async () => {
    let calls = 0;
    const bangla = ANSWER.replace("Shirt er dam 1200 taka.", "শার্টের দাম ১২০০ টাকা।");

    const llm: LlmClient = {
      chat: async () => {
        calls += 1;
        return {
          content:
            calls === 1 ? '{"query":"shirt price","intent":"pricing","language":"bn"}' : bangla,
          model: "test",
          usage: {},
        };
      },
    };

    const result = await engine({ llm, message: "শার্টের দাম কত?" });

    expect(calls).toBe(2);
    expect(result.decision.action).toBe("send");
  });

  test("keeps the first reply when the script retry fails", async () => {
    const mixed = ANSWER.replace("Shirt er dam 1200 taka.", "Shirt er dam ১২০০ টাকা.");
    let calls = 0;

    const llm: LlmClient = {
      chat: async () => {
        calls += 1;

        if (calls === 3) {
          throw new Error("model unavailable");
        }

        return { content: calls === 1 ? REWRITE : mixed, model: "test", usage: {} };
      },
    };

    const result = await engine({ llm });

    expect(result.decision).toEqual({ action: "send", reply: "Shirt er dam ১২০০ টাকা." });
  });

  test("treats a Latin message as Banglish or English even if the rewrite says Bangla", async () => {
    const result = await engine({
      llm: scriptedLlm('{"query":"delivery charge","intent":"delivery","language":"bn"}', ANSWER),
      message: "What are your delivery charges?",
    });

    expect(result.rewrite.language).toBe("en");
  });
});
