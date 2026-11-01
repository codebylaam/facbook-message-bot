import type { LlmClient } from "../llm-types.ts";
import { runReplyEngine } from "../reply/engine.ts";
import type { ReplyKnowledge } from "../reply/types.ts";
import {
  type CatalogEntry,
  catalogChunks,
  catalogText,
  GOLDEN_CASES,
  GOLDEN_CATALOG,
  type GoldenCase,
} from "./golden.ts";
import { type CaseResult, scoreCase } from "./score.ts";

export const GOLDEN_KNOWLEDGE: ReplyKnowledge = {
  pageName: "Dhaka Threads",
  persona: { name: "Rumi", tone: "warm, brief and helpful" },
  profileLines: ["About: Handmade clothing and panjabi from Dhaka"],
  policies: [
    { title: "Delivery", content: "ঢাকার ভিতরে ৬০ টাকা, ঢাকার বাইরে ১২০ টাকা, ২ থেকে ৪ দিনে।" },
    { title: "Returns", content: "পণ্য পাওয়ার ৭ দিনের মধ্যে রিটার্ন করা যাবে।" },
    { title: "Payment", content: "ক্যাশ অন ডেলিভারি, বিকাশ এবং নগদ।" },
  ],
};

export type Usage = {
  promptTokens: number;
  completionTokens: number;
  totalTokens: number;
};

export type EvalReport = {
  total: number;
  passed: number;
  failed: number;
  passRate: number;
  results: CaseResult[];
  usage: Usage;
  byLanguage: Record<string, { total: number; passed: number }>;
};

export function meterUsage(llm: LlmClient): { llm: LlmClient; usage: Usage } {
  const usage: Usage = { promptTokens: 0, completionTokens: 0, totalTokens: 0 };

  const metered: LlmClient = {
    chat: async (messages, options) => {
      const result = await llm.chat(messages, options);
      usage.promptTokens += result.usage.promptTokens ?? 0;
      usage.completionTokens += result.usage.completionTokens ?? 0;
      usage.totalTokens += result.usage.totalTokens ?? 0;
      return result;
    },
  };

  return { llm: metered, usage };
}

export async function runEval(options: {
  llm: LlmClient;
  cases?: GoldenCase[];
  catalog?: CatalogEntry[];
  confidenceThreshold?: number;
  onProgress?: (done: number, total: number) => void;
}): Promise<EvalReport> {
  const cases = options.cases ?? GOLDEN_CASES;
  const catalog = options.catalog ?? GOLDEN_CATALOG;
  const threshold = options.confidenceThreshold ?? 0.7;

  const chunks = catalogChunks(catalog);
  const context = catalogText(catalog);

  const { llm, usage } = meterUsage(options.llm);

  const results: CaseResult[] = [];

  for (const testCase of cases) {
    const result = await runReplyEngine({
      llm,
      knowledge: GOLDEN_KNOWLEDGE,
      retrieve: async () => chunks,
      message: testCase.question,
      confidenceThreshold: threshold,
    });

    results.push(
      scoreCase({
        testCase,
        decision: result.decision,
        output: result.output,
        contextText: context,
      }),
    );

    options.onProgress?.(results.length, cases.length);
  }

  const byLanguage: Record<string, { total: number; passed: number }> = {};

  for (const result of results) {
    const bucket = byLanguage[result.language] ?? { total: 0, passed: 0 };
    bucket.total += 1;

    if (result.passed) {
      bucket.passed += 1;
    }

    byLanguage[result.language] = bucket;
  }

  const passed = results.filter((result) => result.passed).length;

  return {
    total: results.length,
    passed,
    failed: results.length - passed,
    passRate: results.length === 0 ? 0 : passed / results.length,
    results,
    usage,
    byLanguage,
  };
}

export function estimateCost(
  usage: Usage,
  rates: { promptPerMTok?: number; completionPerMTok?: number },
): number | null {
  if (rates.promptPerMTok === undefined || rates.completionPerMTok === undefined) {
    return null;
  }

  return (
    (usage.promptTokens / 1_000_000) * rates.promptPerMTok +
    (usage.completionTokens / 1_000_000) * rates.completionPerMTok
  );
}
