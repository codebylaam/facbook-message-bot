import type { ChatUsage, LlmClient } from "../llm-types.ts";
import { decideReply, handoffDecision } from "./decide.ts";
import { generateReply } from "./generate.ts";
import { rewriteQueryWithFallback } from "./query-rewrite.ts";
import { replyMatchesScript } from "./script.ts";
import type { ReplyEngineResult, ReplyKnowledge, ReplyTurn, Retrieve } from "./types.ts";

export type ReplyEngineInput = {
  llm: LlmClient;
  knowledge: ReplyKnowledge;
  retrieve: Retrieve;
  message: string;
  confidenceThreshold: number;
  history?: ReplyTurn[];
  summary?: string | null;
};

/**
 * Rewrite the message into a search query, retrieve, generate and decide.
 *
 * A retrieval failure is left to propagate so the caller can retry; a generation
 * failure becomes a handoff, because a customer must never be left unanswered.
 */
export async function runReplyEngine(input: ReplyEngineInput): Promise<ReplyEngineResult> {
  const history = input.history ?? [];

  const rewrite = await rewriteQueryWithFallback(input.llm, {
    message: input.message,
    history,
  });

  const retrieved = await input.retrieve(rewrite.query);

  try {
    const generateInput = {
      knowledge: input.knowledge,
      retrieved,
      summary: input.summary ?? null,
      history,
      message: input.message,
      language: rewrite.language,
    };

    let { output, usage } = await generateReply(input.llm, generateInput);

    // The model sometimes answers an English question with Bangla taken straight
    // from the context ("Delivery is ৬০ টাকা"). One corrective retry fixes it; if
    // the retry is still mixed it is sent anyway, since a reply beats silence.
    if (!replyMatchesScript(output.reply, rewrite.language)) {
      try {
        const retry = await generateReply(input.llm, { ...generateInput, scriptRetry: true });
        output = retry.output;
        usage = sumUsage(usage, retry.usage);
      } catch {
        // Keep the first reply: a failed retry must not turn an answer into a handoff.
      }
    }

    return {
      rewrite,
      retrieved,
      output,
      decision: decideReply({ output, threshold: input.confidenceThreshold }),
      generationError: null,
      usage,
    };
  } catch (error) {
    const reason = error instanceof Error ? error.message : "The reply model failed";

    return {
      rewrite,
      retrieved,
      output: null,
      decision: handoffDecision(`The reply model failed: ${reason}`),
      generationError: reason,
      usage: {},
    };
  }
}

function sumUsage(a: ChatUsage, b: ChatUsage): ChatUsage {
  const add = (x?: number, y?: number) =>
    x === undefined && y === undefined ? undefined : (x ?? 0) + (y ?? 0);

  return {
    promptTokens: add(a.promptTokens, b.promptTokens),
    completionTokens: add(a.completionTokens, b.completionTokens),
    totalTokens: add(a.totalTokens, b.totalTokens),
  };
}
