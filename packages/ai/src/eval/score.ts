import type { ReplyDecision, ReplyOutput } from "../reply/types.ts";
import type { GoldenCase } from "./golden.ts";

const BANGLA_DIGITS = "০১২৩৪৫৬৭৮৯";

// Bengali letters only. The block also holds digits and the taka sign (U+09F3),
// and an English reply that writes "৳60" is still an English reply.
const BANGLA_LETTERS = /[\u0985-\u09B9\u09CE\u09DC-\u09DF\u09F0-\u09F1]/g;
const LATIN_RANGE = /[A-Za-z]/g;

export function normalizeDigits(text: string): string {
  return text.replace(/[০-৯]/g, (digit) => String(BANGLA_DIGITS.indexOf(digit)));
}

/**
 * Collapses a thousands separator so "1,200" is one number rather than a 1 and a
 * 200. Getting this wrong makes the scorer invent numbers the model never wrote.
 */
/**
 * A total the model worked out is not an invented fact: two shirts at 1200 is
 * 2400. Only an exact small multiple of one amount in the context counts, so an
 * unrelated made-up price still fails.
 */
export function isDerivedNumber(number: string, knownNumbers: Set<string>): boolean {
  const value = Number(number);

  if (!Number.isFinite(value) || value <= 0) {
    return false;
  }

  for (const known of knownNumbers) {
    const unit = Number(known);

    if (!Number.isFinite(unit) || unit <= 0) {
      continue;
    }

    const multiple = value / unit;

    if (Number.isInteger(multiple) && multiple >= 2 && multiple <= 10) {
      return true;
    }
  }

  return false;
}

export function normalizeNumbers(text: string): string {
  return normalizeDigits(text).replace(/(?<=\d),(?=\d{3}(?!\d))/g, "");
}

export function extractNumbers(text: string): string[] {
  const normalized = normalizeNumbers(text);
  const matches = normalized.match(/\d+(?:\.\d+)?/g) ?? [];

  return matches.map((match) => String(Number(match))).filter((value) => Number(value) >= 10);
}

export function scriptCounts(text: string): { bangla: number; latin: number } {
  return {
    bangla: (text.match(BANGLA_LETTERS) ?? []).length,
    latin: (text.match(LATIN_RANGE) ?? []).length,
  };
}

export function containsBangla(text: string): boolean {
  return (text.match(BANGLA_LETTERS) ?? []).length > 0;
}

export function dominantScript(text: string): "bangla" | "latin" {
  const counts = scriptCounts(text);
  return counts.bangla > counts.latin ? "bangla" : "latin";
}

export type CaseResult = {
  id: string;
  language: GoldenCase["language"];
  passed: boolean;
  failures: string[];
  reply: string;
  action: "send" | "handoff";
};

export function scoreCase(input: {
  testCase: GoldenCase;
  decision: ReplyDecision;
  output: ReplyOutput | null;
  contextText: string;
}): CaseResult {
  const { testCase, decision, output, contextText } = input;
  const failures: string[] = [];
  const reply = output?.reply ?? "";
  const normalizedReply = normalizeNumbers(reply);

  if (testCase.expects.handoff && decision.action !== "handoff") {
    failures.push("expected a handoff but the bot answered");
  }

  if (!testCase.expects.handoff && decision.action !== "send") {
    const reason = decision.action === "handoff" ? decision.reason : "unknown";
    failures.push(`expected an answer but it handed off: ${reason}`);
  }

  if (!testCase.expects.handoff && decision.action === "send") {
    for (const fact of testCase.expects.facts ?? []) {
      if (!normalizedReply.includes(fact)) {
        failures.push(`reply is missing the fact ${fact}`);
      }
    }

    for (const forbidden of testCase.expects.forbidden ?? []) {
      if (normalizedReply.includes(forbidden)) {
        failures.push(`reply contains the forbidden text ${forbidden}`);
      }
    }

    const knownNumbers = new Set(extractNumbers(contextText));

    for (const number of extractNumbers(reply)) {
      if (!knownNumbers.has(number) && !isDerivedNumber(number, knownNumbers)) {
        failures.push(`reply invents the number ${number}, which is not in the context`);
      }
    }

    if (testCase.language === "bn" && dominantScript(reply) !== "bangla") {
      failures.push("expected a Bangla reply");
    }

    if (testCase.language === "en" && dominantScript(reply) !== "latin") {
      failures.push("expected an English reply");
    }

    if (containsBangla(reply) && dominantScript(reply) === "latin" && testCase.language === "en") {
      failures.push("an English reply still contains Bangla script");
    }
  }

  return {
    id: testCase.id,
    language: testCase.language,
    passed: failures.length === 0,
    failures,
    reply,
    action: decision.action,
  };
}
