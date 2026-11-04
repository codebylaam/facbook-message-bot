import { describe, expect, test } from "bun:test";
import type { ReplyDecision, ReplyOutput } from "../reply/types.ts";
import type { GoldenCase } from "./golden.ts";
import {
  containsBangla,
  dominantScript,
  extractNumbers,
  isDerivedNumber,
  normalizeDigits,
  scoreCase,
} from "./score.ts";

function output(overrides: Partial<ReplyOutput> = {}): ReplyOutput {
  return {
    reply: "শার্টের দাম ১২০০ টাকা।",
    confidence: 0.9,
    needsHuman: false,
    handoffReason: null,
    intent: "pricing",
    sourceIds: [],
    lead: null,
    ...overrides,
  };
}

const CONTEXT = "Cotton Shirt. Price: 1200.00 BDT. Delivery inside Dhaka is 60 BDT.";

function score(
  testCase: Partial<GoldenCase> & Pick<GoldenCase, "expects">,
  decision: ReplyDecision,
  reply: ReplyOutput = output(),
) {
  return scoreCase({
    testCase: {
      id: "case",
      language: "bn",
      question: "q",
      ...testCase,
    } as GoldenCase,
    decision,
    output: reply,
    contextText: CONTEXT,
  });
}

describe("normalizeDigits", () => {
  test("turns Bangla digits into ascii digits", () => {
    expect(normalizeDigits("দাম ১২০০ টাকা")).toBe("দাম 1200 টাকা");
  });

  test("leaves ascii digits alone", () => {
    expect(normalizeDigits("price 1200")).toBe("price 1200");
  });
});

describe("extractNumbers", () => {
  test("finds numbers of ten or more", () => {
    expect(extractNumbers("prise 1200 and 60")).toEqual(["1200", "60"]);
  });

  test("ignores single digit noise", () => {
    expect(extractNumbers("size 7 and 5")).toEqual([]);
  });

  test("normalises Bangla digits first", () => {
    expect(extractNumbers("দাম ১২০০")).toEqual(["1200"]);
  });

  test("strips trailing zeros", () => {
    expect(extractNumbers("1200.00")).toEqual(["1200"]);
  });
});

describe("number normalization", () => {
  test("reads a thousands separator as one number", () => {
    // The regression: "1,200" was read as 1 and 200, so the scorer invented 200
    // and 500 out of a correct reply.
    const numbers = extractNumbers("1,200 BDT instead of 1,500 BDT");

    expect(numbers).toContain("1200");
    expect(numbers).toContain("1500");
    expect(numbers).not.toContain("200");
    expect(numbers).not.toContain("500");
  });

  test("passes a fact written with a comma", () => {
    const result = scoreCase({
      testCase: {
        id: "en-sale",
        language: "en",
        question: "Is the hoodie on sale?",
        expects: { handoff: false, facts: ["1200"] },
      },
      decision: { action: "send", reply: "Yes, 1,200 BDT instead of 1,500 BDT." },
      output: output({ reply: "Yes, 1,200 BDT instead of 1,500 BDT." }),
      contextText: "Winter hoodie. Price: 1500.00 BDT. Sale price: 1200.00 BDT.",
    });

    expect(result.failures).toEqual([]);
  });

  test("still catches an invented number next to a comma-grouped one", () => {
    const result = scoreCase({
      testCase: {
        id: "en-sale",
        language: "en",
        question: "Is the hoodie on sale?",
        expects: { handoff: false },
      },
      decision: { action: "send", reply: "Yes, 1,200 BDT with a 3,499 BDT gift." },
      output: output({ reply: "Yes, 1,200 BDT with a 3,499 BDT gift." }),
      contextText: "Winter hoodie. Sale price: 1200.00 BDT.",
    });

    expect(result.failures).toContain("reply invents the number 3499, which is not in the context");
  });
});

describe("derived numbers", () => {
  test("accepts a total the model computed from a unit price", () => {
    // The bot said "2 shirts at 1200 is 2400"; that is arithmetic, not a fabrication.
    const known = new Set(["1200"]);

    expect(isDerivedNumber("2400", known)).toBe(true);
    expect(isDerivedNumber("1200", known)).toBe(false);
  });

  test("still rejects a number unrelated to anything in the context", () => {
    expect(isDerivedNumber("3499", new Set(["1200", "1500"]))).toBe(false);
    expect(isDerivedNumber("24000", new Set(["1200"]))).toBe(false);
  });

  test("passes a case where the bot multiplies a known price", () => {
    const result = scoreCase({
      testCase: {
        id: "bn-order",
        language: "bn",
        question: "২টা শার্ট নিতে চাই",
        expects: { handoff: false },
      },
      decision: { action: "send", reply: "প্রতিটির দাম ১২০০ টাকা, ২টার জন্য ২৪০০ টাকা।" },
      output: output({ reply: "প্রতিটির দাম ১২০০ টাকা, ২টার জন্য ২৪০০ টাকা।" }),
      contextText: "কটন শার্ট। দাম: 1200.00 BDT।",
    });

    expect(result.failures).toEqual([]);
  });
});

describe("Bangla detection", () => {
  test("does not treat the taka sign as Bangla script", () => {
    // The regression: an English reply writing "৳60" was scored as Bangla.
    expect(containsBangla("Inside Dhaka delivery is ৳60")).toBe(false);
    expect(dominantScript("Inside Dhaka delivery is ৳60 and ৳120")).toBe("latin");
  });

  test("does not treat Bangla digits alone as Bangla script", () => {
    expect(containsBangla("1200 and ৬০")).toBe(false);
  });

  test("still detects a reply written in Bangla", () => {
    expect(containsBangla("শার্টের দাম ১২০০ টাকা।")).toBe(true);
    expect(dominantScript("শার্টের দাম ১২০০ টাকা।")).toBe("bangla");
  });

  test("passes an English reply that only borrows the currency sign", () => {
    const result = scoreCase({
      testCase: {
        id: "en-delivery",
        language: "en",
        question: "What are your delivery charges?",
        expects: { handoff: false, facts: ["60", "120"] },
      },
      decision: {
        action: "send",
        reply: "Inside Dhaka delivery is ৳60 and outside Dhaka it's ৳120.",
      },
      output: output({ reply: "Inside Dhaka delivery is ৳60 and outside Dhaka it's ৳120." }),
      contextText: "Delivery: inside Dhaka 60 BDT, outside Dhaka 120 BDT.",
    });

    expect(result.failures).toEqual([]);
  });
});

describe("dominantScript", () => {
  test("detects a Bangla reply", () => {
    expect(dominantScript("জি, সাইজ এল আছে।")).toBe("bangla");
  });

  test("detects a latin reply", () => {
    expect(dominantScript("Yes, size L is available.")).toBe("latin");
  });

  test("containsBangla", () => {
    expect(containsBangla("দাম ১২০০")).toBe(true);
    expect(containsBangla("price 1200")).toBe(false);
  });
});

describe("scoreCase", () => {
  test("passes an answer with the right fact", () => {
    const result = score(
      { expects: { handoff: false, facts: ["1200"] } },
      { action: "send", reply: "শার্টের দাম ১২০০ টাকা।" },
    );

    expect(result.passed).toBe(true);
  });

  test("fails when an expected fact is missing", () => {
    const result = score(
      { expects: { handoff: false, facts: ["1800"] } },
      { action: "send", reply: "শার্টের দাম ১২০০ টাকা।" },
    );

    expect(result.passed).toBe(false);
    expect(result.failures.join(" ")).toContain("missing the fact 1800");
  });

  test("matches a fact written in Bangla digits", () => {
    const result = score(
      { expects: { handoff: false, facts: ["1200"] } },
      { action: "send", reply: "দাম ১২০০ টাকা" },
    );

    expect(result.passed).toBe(true);
  });

  test("fails when a number is invented", () => {
    const result = score(
      { expects: { handoff: false, facts: ["1200"] } },
      { action: "send", reply: "দাম ১২০০ টাকা, ডেলিভারি ৯৯৯ টাকা।" },
      output({ reply: "দাম ১২০০ টাকা, ডেলিভারি ৯৯৯ টাকা।" }),
    );

    expect(result.passed).toBe(false);
    expect(result.failures.join(" ")).toContain("invents the number 999");
  });

  test("allows a number that is in the context", () => {
    const result = score(
      { expects: { handoff: false, facts: ["1200"] } },
      { action: "send", reply: "দাম ১২০০, ঢাকায় ডেলিভারি ৬০ টাকা।" },
      output({ reply: "দাম ১২০০, ঢাকায় ডেলিভারি ৬০ টাকা।" }),
    );

    expect(result.passed).toBe(true);
  });

  test("fails when the bot answers a question that needed a human", () => {
    const result = score(
      { expects: { handoff: true } },
      { action: "send", reply: "শার্টের দাম ১২০০ টাকা।" },
    );

    expect(result.passed).toBe(false);
    expect(result.failures.join(" ")).toContain("expected a handoff");
  });

  test("passes a correct handoff", () => {
    const result = score(
      { expects: { handoff: true } },
      { action: "handoff", reason: "not in the catalog", draft: "" },
    );

    expect(result.passed).toBe(true);
  });

  test("fails when an answerable question was handed off", () => {
    const result = score(
      { expects: { handoff: false, facts: ["1200"] } },
      { action: "handoff", reason: "Confidence 0.20 is below the threshold 0.7", draft: "" },
    );

    expect(result.passed).toBe(false);
    expect(result.failures.join(" ")).toContain("expected an answer but it handed off");
  });

  test("fails an English question answered in Bangla", () => {
    const result = score(
      { language: "en", expects: { handoff: false, facts: ["1200"] } },
      { action: "send", reply: "শার্টের দাম ১২০০ টাকা।" },
    );

    expect(result.passed).toBe(false);
    expect(result.failures.join(" ")).toContain("expected an English reply");
  });

  test("fails a Bangla question answered in English", () => {
    const result = score(
      { language: "bn", expects: { handoff: false } },
      { action: "send", reply: "The price is 1200 taka." },
      output({ reply: "The price is 1200 taka." }),
    );

    expect(result.passed).toBe(false);
    expect(result.failures.join(" ")).toContain("expected a Bangla reply");
  });

  test("reports a forbidden phrase", () => {
    const result = score(
      { expects: { handoff: false, forbidden: ["out of stock"] } },
      { action: "send", reply: "শার্টের দাম ১২০০, কিন্তু out of stock।" },
      output({ reply: "শার্টের দাম ১২০০, কিন্তু out of stock।" }),
    );

    expect(result.passed).toBe(false);
    expect(result.failures.join(" ")).toContain("forbidden text");
  });

  test("does not check facts on a handoff", () => {
    const result = score(
      { expects: { handoff: true } },
      { action: "handoff", reason: "x", draft: "" },
    );

    expect(result.failures).toEqual([]);
  });
});
