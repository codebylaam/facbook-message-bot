import {
  type EmbeddingsClient,
  hybridSearch,
  type LlmClient,
  type RetrievedChunk,
  runReplyEngine,
} from "@fb-bot/ai";
import { type Db, findPageById, findPageProfile, listPoliciesForPage } from "@fb-bot/db";
import { profileLines } from "@fb-bot/meta";
import type { PlaygroundResponse } from "@fb-bot/shared";
import { logger } from "../logger.ts";
import { PageConnectionError } from "./pages.ts";

export type PlaygroundDeps = {
  db: Db;
  llm: LlmClient;
  embeddings: EmbeddingsClient | null;
};

export async function runPlayground(
  deps: PlaygroundDeps,
  input: {
    pageId: string;
    message: string;
    history?: { role: "customer" | "bot" | "human"; text: string }[];
  },
): Promise<PlaygroundResponse> {
  const page = await findPageById(deps.db, input.pageId);

  if (!page) {
    throw new PageConnectionError("Page not found", 404);
  }

  const [profile, policies] = await Promise.all([
    findPageProfile(deps.db, page.id),
    listPoliciesForPage(deps.db, page.id),
  ]);

  let embeddingsUsed = deps.embeddings !== null;

  const retrieve = async (query: string): Promise<RetrievedChunk[]> => {
    let embedding: number[] | null = null;

    if (deps.embeddings) {
      try {
        embedding = await deps.embeddings.embedOne(query);
      } catch (error) {
        // The playground has to stay usable when the embeddings service is down.
        embeddingsUsed = false;
        logger.warn({ err: error }, "[api] playground falling back to text-only retrieval");
      }
    }

    return hybridSearch(deps.db, { pageId: page.id, query, embedding });
  };

  const result = await runReplyEngine({
    llm: deps.llm,
    knowledge: {
      pageName: page.name,
      persona: page.persona,
      profileLines: profile ? profileLines(profile) : [],
      policies: policies.map((policy) => ({ title: policy.title, content: policy.content })),
    },
    retrieve,
    message: input.message,
    confidenceThreshold: page.confidenceThreshold,
    history: input.history ?? [],
  });

  return {
    rewrite: result.rewrite,
    retrieved: result.retrieved.map((chunk) => ({
      id: chunk.id,
      sourceType: chunk.sourceType,
      content: chunk.content,
      score: chunk.score,
    })),
    decision:
      result.decision.action === "send"
        ? { action: "send", reply: result.decision.reply }
        : { action: "handoff", reason: result.decision.reason, draft: result.decision.draft },
    output: result.output
      ? {
          reply: result.output.reply,
          confidence: result.output.confidence,
          needsHuman: result.output.needsHuman,
          intent: result.output.intent,
          handoffReason: result.output.handoffReason,
        }
      : null,
    generationError: result.generationError,
    embeddingsUsed,
  };
}
