import { chunkText } from "@fb-bot/ai";
import { deleteChunksForSource, type KnowledgeSource, replaceChunksForSource } from "@fb-bot/db";
import type { WorkerDeps } from "../deps.ts";
import { logger } from "../logger.ts";

export type EmbedSourceInput = {
  pageId: string;
  sourceType: KnowledgeSource;
  sourceId: string;
  text: string;
};

let warnedAboutMissingProvider = false;

export async function reembedSource(deps: WorkerDeps, input: EmbedSourceInput): Promise<number> {
  const text = input.text.replace(/\s+/g, " ").trim();

  if (text.length === 0) {
    await deleteChunksForSource(deps.db, input.pageId, input.sourceType, input.sourceId);
    return 0;
  }

  const chunks = chunkText(text);

  if (!deps.embeddings && !warnedAboutMissingProvider) {
    warnedAboutMissingProvider = true;
    logger.warn(
      "[worker] no embeddings provider is configured, so chunks are stored without vectors and search stays keyword only",
    );
  }

  // A missing provider is a supported degraded state: keep the text searchable and
  // leave the vector empty so a later backfill can fill it in.
  const vectors = deps.embeddings ? await deps.embeddings.embed(chunks) : null;

  await replaceChunksForSource(deps.db, {
    pageId: input.pageId,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    chunks: chunks.map((content, index) => ({
      content,
      embedding: vectors?.[index] ?? null,
    })),
  });

  return chunks.length;
}
