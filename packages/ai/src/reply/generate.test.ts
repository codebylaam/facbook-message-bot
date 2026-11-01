import { describe, expect, test } from "bun:test";
import type { ChatResult, LlmClient } from "../llm-types.ts";
import { generateReply, ReplyGenerationError } from "./generate.ts";

function stubLlm(content: string): LlmClient {
  return {
    chat: async (): Promise<ChatResult> => ({
      content,
      model: "test",
      usage: { promptTokens: 100, completionTokens: 20, totalTokens: 120 },
    }),
  };
}

const INPUT = {
  knowledge: { pageName: "Dhaka Threads", persona: null, profileLines: [], policies: [] },
  retrieved: [],
  summary: null,
  history: [],
  message: "dam koto?",
  language: "banglish" as const,
};

function answer(overrides: Record<string, unknown> = {}) {
  return JSON.stringify({
    reply: "শার্টের দাম ১২০০ টাকা।",
    confidence: 0.92,
    needs_human: false,
    handoff_reason: null,
    intent: "pricing",
    source_ids: ["chunk-1"],
    lead: null,
    ...overrides,
  });
}

describe("generateReply", () => {
  test("maps the model output", async () => {
    const { output, usage } = await generateReply(stubLlm(answer()), INPUT);

    expect(output.reply).toBe("শার্টের দাম ১২০০ টাকা।");
    expect(output.confidence).toBe(0.92);
    expect(output.needsHuman).toBe(false);
    expect(output.intent).toBe("pricing");
    expect(output.sourceIds).toEqual(["chunk-1"]);
    expect(output.lead).toBeNull();
    expect(usage.totalTokens).toBe(120);
  });

  test("accepts a fenced response", async () => {
    const { output } = await generateReply(stubLlm(`\`\`\`json\n${answer()}\n\`\`\``), INPUT);

    expect(output.intent).toBe("pricing");
  });

  test("trims the reply", async () => {
    const { output } = await generateReply(stubLlm(answer({ reply: "  hi  " })), INPUT);

    expect(output.reply).toBe("hi");
  });

  test("maps a lead with its items", async () => {
    const { output } = await generateReply(
      stubLlm(
        answer({
          lead: {
            name: "Karim",
            phone: "01700000000",
            address: "Mirpur",
            items: [{ name: "Cotton Shirt", quantity: 2, variant: "L" }],
          },
        }),
      ),
      INPUT,
    );

    expect(output.lead).toEqual({
      name: "Karim",
      phone: "01700000000",
      address: "Mirpur",
      items: [{ name: "Cotton Shirt", quantity: 2, variant: "L" }],
    });
  });

  test("treats a lead with no items as no lead", async () => {
    const { output } = await generateReply(
      stubLlm(answer({ lead: { name: "Karim", phone: null, address: null, items: [] } })),
      INPUT,
    );

    expect(output.lead).toBeNull();
  });

  test("blanks a whitespace handoff reason", async () => {
    const { output } = await generateReply(stubLlm(answer({ handoff_reason: "   " })), INPUT);

    expect(output.handoffReason).toBeNull();
  });

  test("throws on a body that is not json", async () => {
    await expect(generateReply(stubLlm("I think the price is 1200"), INPUT)).rejects.toThrow(
      ReplyGenerationError,
    );
  });

  test("hands off when the confidence is unreadable", async () => {
    const { output } = await generateReply(stubLlm(answer({ confidence: "very sure" })), INPUT);

    expect(output.confidence).toBe(0);
  });

  test("hands off when needs_human is unreadable", async () => {
    const { output } = await generateReply(stubLlm(answer({ needs_human: "maybe" })), INPUT);

    expect(output.needsHuman).toBe(true);
  });

  test("falls back to other for an unknown intent", async () => {
    const { output } = await generateReply(stubLlm(answer({ intent: "chit chat" })), INPUT);

    expect(output.intent).toBe("other");
  });

  test("survives a confidence outside the allowed range", async () => {
    const { output } = await generateReply(stubLlm(answer({ confidence: 7 })), INPUT);

    expect(output.confidence).toBe(0);
  });

  test("drops a source_ids field that is not a list", async () => {
    const { output } = await generateReply(stubLlm(answer({ source_ids: "chunk-1" })), INPUT);

    expect(output.sourceIds).toEqual([]);
  });

  test("still produces an output when the model omits every field", async () => {
    const { output } = await generateReply(stubLlm("{}"), INPUT);

    expect(output.reply).toBe("");
    expect(output.needsHuman).toBe(true);
    expect(output.confidence).toBe(0);
    expect(output.lead).toBeNull();
  });
});
