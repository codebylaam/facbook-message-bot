import type { LlmClient } from "../llm-types.ts";
import { decideReply, handoffDecision } from "./decide.ts";
import { generateReply } from "./generate.ts";
import { rewriteQueryWithFallback } from "./query-rewrite.ts";
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
    const { output, usage } = await generateReply(input.llm, {
      knowledge: input.knowledge,
      retrieved,
      summary: input.summary ?? null,
      history,
      message: input.message,
      language: rewrite.language,
    });

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
