import { describe, expect, test } from "bun:test";
import type { ReplyDecision, ReplyOutput } from "../reply/types.ts";
import type { GoldenCase } from "./golden.ts";
import {
  containsBangla,
  dominantScript,
  extractNumbers,
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
