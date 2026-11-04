import { describe, expect, test } from "bun:test";
import { decideReply, handoffDecision } from "./decide.ts";
import type { ReplyOutput } from "./types.ts";

function output(overrides: Partial<ReplyOutput> = {}): ReplyOutput {
  return {
    reply: "জি, সাইজ এল আছে। দাম ১২০০ টাকা।",
    confidence: 0.9,
    needsHuman: false,
    handoffReason: null,
    intent: "pricing",
    sourceIds: ["chunk-1"],
    lead: null,
    ...overrides,
  };
}

describe("decideReply", () => {
  test("sends a confident answer", () => {
    expect(decideReply({ output: output(), threshold: 0.7 })).toEqual({
      action: "send",
      reply: "জি, সাইজ এল আছে। দাম ১২০০ টাকা।",
    });
  });

  test("sends when the confidence is exactly the threshold", () => {
    const decision = decideReply({ output: output({ confidence: 0.7 }), threshold: 0.7 });

    expect(decision.action).toBe("send");
  });

  test("hands off when the model asks for a human", () => {
    const decision = decideReply({
      output: output({
        needsHuman: true,
        handoffReason: "Delivery to Canada is not in the policy",
      }),
      threshold: 0.7,
    });

    expect(decision.action).toBe("handoff");
    expect(decision).toMatchObject({
      reason: "Delivery to Canada is not in the policy",
      draft: "জি, সাইজ এল আছে। দাম ১২০০ টাকা।",
    });
  });

  test("hands off below the confidence threshold and says why", () => {
    const decision = decideReply({ output: output({ confidence: 0.42 }), threshold: 0.7 });

    expect(decision.action).toBe("handoff");
    expect(decision).toMatchObject({ reason: "Confidence 0.42 is below the threshold 0.7" });
  });

  test("hands off an order so a human can confirm it", () => {
    const decision = decideReply({
      output: output({
        lead: {
          name: "Karim",
          phone: "01700000000",
          address: "Mirpur",
          items: [{ name: "Cotton Shirt", quantity: 2, variant: "L" }],
        },
      }),
      threshold: 0.7,
    });

    expect(decision.action).toBe("handoff");
    expect(decision).toMatchObject({
      reason: "The customer is placing an order, which a human must confirm",
    });
  });

  test("an order wins even when the model was confident", () => {
    const decision = decideReply({
      output: output({
        confidence: 0.99,
        lead: {
          name: null,
          phone: "01700000000",
          address: null,
          items: [{ name: "Denim Pant", quantity: null, variant: null }],
        },
      }),
      threshold: 0.7,
    });

    expect(decision.action).toBe("handoff");
  });

  test("hands off an empty reply", () => {
    const decision = decideReply({ output: output({ reply: "   " }), threshold: 0.7 });

    expect(decision.action).toBe("handoff");
    expect(decision).toMatchObject({ reason: "The model returned an empty reply" });
  });

  test("uses a fallback reason when the model gives none", () => {
    const decision = decideReply({
      output: output({ needsHuman: true, handoffReason: null }),
      threshold: 0.7,
    });

    expect(decision).toMatchObject({
      reason: "The model could not answer from the shop's knowledge",
    });
  });

  test("keeps the model's text as a draft on handoff", () => {
    const decision = decideReply({ output: output({ confidence: 0.1 }), threshold: 0.7 });

    expect(decision).toMatchObject({
      action: "handoff",
      draft: "জি, সাইজ এল আছে। দাম ১২০০ টাকা।",
    });
  });
});

describe("handoffDecision", () => {
  test("builds a handoff with no draft", () => {
    expect(handoffDecision("something broke")).toEqual({
      action: "handoff",
      reason: "something broke",
      draft: "",
    });
  });
});

describe("orders still being collected", () => {
  const base = {
    confidence: 0.9,
    needsHuman: false,
    handoffReason: null,
    intent: "order" as const,
    sourceIds: [],
  };

  test("does not hand off for a lead with items but no way to reach the customer", () => {
    const result = decideReply({
      output: {
        ...base,
        reply: "Sure, how many would you like?",
        lead: {
          name: null,
          phone: null,
          address: null,
          items: [{ name: "Cotton Shirt", quantity: 2, variant: null }],
        },
      },
      threshold: 0.5,
    });

    expect(result.action).toBe("send");
  });

  test("hands off once a phone number arrives", () => {
    const result = decideReply({
      output: {
        ...base,
        reply: "Got it, confirming now.",
        lead: {
          name: null,
          phone: "01700000000",
          address: null,
          items: [{ name: "Cotton Shirt", quantity: 2, variant: null }],
        },
      },
      threshold: 0.5,
    });

    expect(result.action).toBe("handoff");
  });

  test("hands off once an address arrives", () => {
    const result = decideReply({
      output: {
        ...base,
        reply: "Got it, confirming now.",
        lead: { name: null, phone: null, address: "Mirpur", items: [] },
      },
      threshold: 0.5,
    });

    expect(result.action).toBe("handoff");
  });
});
