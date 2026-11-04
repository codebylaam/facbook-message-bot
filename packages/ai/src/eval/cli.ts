import { createLlmClient } from "../llm.ts";
import { createBaselineLlm } from "./baseline.ts";
import { GOLDEN_CASES } from "./golden.ts";
import { estimateCost, runEval } from "./run.ts";

function flag(name: string): string | undefined {
  const index = process.argv.indexOf(name);

  if (index === -1) {
    return undefined;
  }

  return process.argv[index + 1];
}

const dry = process.argv.includes("--dry");
const asJson = process.argv.includes("--json");
const limit = Number(flag("--limit") ?? GOLDEN_CASES.length);
const confidenceThreshold = Number(flag("--threshold") ?? 0.7);

const only = flag("--only");
const selected = only
  ? GOLDEN_CASES.filter((testCase) => testCase.id.includes(only))
  : GOLDEN_CASES;
const cases = selected.slice(0, Number.isFinite(limit) ? limit : selected.length);

if (only && cases.length === 0) {
  console.error(`No golden case matches "${only}".`);
  process.exit(1);
}

function buildLlm() {
  if (dry) {
    return createBaselineLlm();
  }

  const apiKey = process.env.CMD_API_KEY ?? "";

  if (apiKey.length === 0) {
    console.error(
      "CMD_API_KEY is not set. Run `bun run eval --dry` for the offline baseline, or set the key to score the real model.",
    );
    process.exit(1);
  }

  return createLlmClient({
    apiKey,
    baseUrl: process.env.CMD_BASE_URL ?? "https://api.commandcode.ai/provider/v1",
    model: process.env.LLM_MODEL ?? "deepseek/deepseek-v4-flash",
  });
}

const started = Date.now();

const report = await runEval({
  llm: buildLlm(),
  cases,
  confidenceThreshold,
  onProgress: (done, total) => {
    if (!asJson) {
      process.stdout.write(`\rscoring ${done}/${total}`);
    }
  },
});

const cost = estimateCost(report.usage, {
  promptPerMTok: process.env.EVAL_PROMPT_COST_PER_MTOK
    ? Number(process.env.EVAL_PROMPT_COST_PER_MTOK)
    : undefined,
  completionPerMTok: process.env.EVAL_COMPLETION_COST_PER_MTOK
    ? Number(process.env.EVAL_COMPLETION_COST_PER_MTOK)
    : undefined,
});

if (asJson) {
  console.log(JSON.stringify({ ...report, dry, cost, elapsedMs: Date.now() - started }, null, 2));
} else {
  process.stdout.write("\r");

  for (const result of report.results) {
    if (result.passed) {
      continue;
    }

    console.log(`FAIL ${result.id} [${result.language}] ${result.action}`);
    for (const failure of result.failures) {
      console.log(`     - ${failure}`);
    }
    if (result.reply) {
      console.log(`     reply: ${result.reply.slice(0, 160)}`);
    }
  }

  console.log("");
  console.log(
    `${dry ? "dry run (naive baseline)" : "real model"} · ${report.passed}/${report.total} passed · ${(report.passRate * 100).toFixed(1)}%`,
  );

  for (const [language, bucket] of Object.entries(report.byLanguage)) {
    console.log(`  ${language}: ${bucket.passed}/${bucket.total}`);
  }

  console.log(
    `  tokens: ${report.usage.promptTokens} prompt + ${report.usage.completionTokens} completion`,
  );

  if (cost !== null) {
    console.log(`  estimated cost: $${cost.toFixed(4)}`);
  }

  console.log(`  elapsed: ${((Date.now() - started) / 1000).toFixed(1)}s`);
}
