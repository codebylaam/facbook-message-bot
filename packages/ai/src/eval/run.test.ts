import { describe, expect, test } from "bun:test";
import type { ChatResult, LlmClient } from "../llm-types.ts";
import type { GoldenCase } from "./golden.ts";
import { estimateCost, meterUsage, runEval } from "./run.ts";

const CASES: GoldenCase[] = [
  {
    id: "priced",
    language: "bn",
    question: "শার্টের দাম কত?",
    expects: { handoff: false, facts: ["1200"] },
  },
  { id: "unknown", language: "en", question: "Do you ship to Canada?", expects: { handoff: true } },
];

const REWRITE = {
  content: '{"query":"shirt price","intent":"pricing","language":"bn"}',
  model: "test",
  usage: { promptTokens: 5, completionTokens: 5, totalTokens: 10 },
};

function answeringLlm(): LlmClient {
  return {
    chat: async (messages): Promise<ChatResult> => {
      const prompt = messages.map((message) => message.content).join("\n");

      if (prompt.includes("search query")) {
        return REWRITE;
      }

      if (prompt.includes("Canada")) {
        return {
          content: JSON.stringify({
            reply: "",
            confidence: 0.2,
            needs_human: true,
            handoff_reason: "We only deliver inside Bangladesh",
            intent: "delivery",
            source_ids: [],
            lead: null,
          }),
          model: "test",
          usage: { promptTokens: 50, completionTokens: 10, totalTokens: 60 },
        };
      }

      return {
        content: JSON.stringify({
          reply: "শার্টের দাম ১২০০ টাকা।",
          confidence: 0.9,
          needs_human: false,
          handoff_reason: null,
          intent: "pricing",
          source_ids: ["product-shirt"],
          lead: null,
        }),
        model: "test",
        usage: { promptTokens: 50, completionTokens: 10, totalTokens: 60 },
      };
    },
  };
}

describe("runEval", () => {
  test("scores every case", async () => {
    const report = await runEval({ llm: answeringLlm(), cases: CASES });

    expect(report.total).toBe(2);
    expect(report.passed).toBe(2);
    expect(report.failed).toBe(0);
    expect(report.passRate).toBe(1);
  });

  test("groups the results by language", async () => {
    const report = await runEval({ llm: answeringLlm(), cases: CASES });

    expect(report.byLanguage.bn).toEqual({ total: 1, passed: 1 });
    expect(report.byLanguage.en).toEqual({ total: 1, passed: 1 });
  });

  test("meters the token usage of both calls per case", async () => {
    const report = await runEval({ llm: answeringLlm(), cases: CASES });

    expect(report.usage.totalTokens).toBe(140);
  });

  test("reports a failure with its reasons", async () => {
    const wrong: LlmClient = {
      chat: async (messages) => {
        const prompt = messages.map((message) => message.content).join("\n");

        if (prompt.includes("search query")) {
          return REWRITE;
        }

        return {
          content: JSON.stringify({
            reply: "দাম ৯৯৯ টাকা।",
            confidence: 0.9,
            needs_human: false,
            handoff_reason: null,
            intent: "pricing",
            source_ids: [],
            lead: null,
          }),
          model: "test",
          usage: {},
        };
      },
    };

    const report = await runEval({ llm: wrong, cases: CASES });
    const priced = report.results.find((result) => result.id === "priced");

    expect(priced?.passed).toBe(false);
    expect(priced?.failures.join(" ")).toContain("missing the fact 1200");
    expect(report.passed).toBe(0);
  });

  test("reports progress", async () => {
    const seen: number[] = [];

    await runEval({
      llm: answeringLlm(),
      cases: CASES,
      onProgress: (done) => seen.push(done),
    });

    expect(seen).toEqual([1, 2]);
  });

  test("handles an empty case list", async () => {
    const report = await runEval({ llm: answeringLlm(), cases: [] });

    expect(report.total).toBe(0);
    expect(report.passRate).toBe(0);
  });

  test("runs the real golden set against the naive baseline", async () => {
    const { createBaselineLlm } = await import("./baseline.ts");
    const { GOLDEN_CASES } = await import("./golden.ts");

    const report = await runEval({ llm: createBaselineLlm(), cases: GOLDEN_CASES });

    // The baseline always sends and never reads the question, so it cannot pass
    // the handoff cases. This keeps the harness from rubber stamping anything.
    expect(report.total).toBeGreaterThanOrEqual(60);
    expect(report.passRate).toBeLessThan(0.5);
  });
});

describe("meterUsage", () => {
  test("accumulates across calls", async () => {
    const { llm, usage } = meterUsage(answeringLlm());

    await llm.chat([{ role: "user", content: "a" }]);
    await llm.chat([{ role: "user", content: "b" }]);

    expect(usage.totalTokens).toBe(120);
  });
});

describe("estimateCost", () => {
  test("returns null when no rates are given", () => {
    expect(
      estimateCost({ promptTokens: 100, completionTokens: 50, totalTokens: 150 }, {}),
    ).toBeNull();
  });

  test("computes the cost from the rates", () => {
    const cost = estimateCost(
      { promptTokens: 1_000_000, completionTokens: 1_000_000, totalTokens: 2_000_000 },
      { promptPerMTok: 0.2, completionPerMTok: 0.8 },
    );

    expect(cost).toBeCloseTo(1.0, 6);
  });
});
