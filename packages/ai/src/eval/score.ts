import type { ReplyDecision, ReplyOutput } from "../reply/types.ts";
import type { GoldenCase } from "./golden.ts";

const BANGLA_DIGITS = "০১২৩৪৫৬৭৮৯";
const BANGLA_RANGE = /[\u0980-\u09FF]/g;
const LATIN_RANGE = /[A-Za-z]/g;

export function normalizeDigits(text: string): string {
  return text.replace(/[০-৯]/g, (digit) => String(BANGLA_DIGITS.indexOf(digit)));
}

export function extractNumbers(text: string): string[] {
  const normalized = normalizeDigits(text);
  const matches = normalized.match(/\d+(?:\.\d+)?/g) ?? [];

  return matches.map((match) => String(Number(match))).filter((value) => Number(value) >= 10);
}

export function scriptCounts(text: string): { bangla: number; latin: number } {
  return {
    bangla: (text.match(BANGLA_RANGE) ?? []).length,
    latin: (text.match(LATIN_RANGE) ?? []).length,
  };
}

export function containsBangla(text: string): boolean {
  return (text.match(BANGLA_RANGE) ?? []).length > 0;
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
  const normalizedReply = normalizeDigits(reply);

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
      if (!knownNumbers.has(number)) {
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
