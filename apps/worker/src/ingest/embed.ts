import { chunkText } from "@fb-bot/ai";
import { deleteChunksForSource, type KnowledgeSource, replaceChunksForSource } from "@fb-bot/db";
import type { WorkerDeps } from "../deps.ts";

export type EmbedSourceInput = {
  pageId: string;
  sourceType: KnowledgeSource;
  sourceId: string;
  text: string;
};

export async function reembedSource(deps: WorkerDeps, input: EmbedSourceInput): Promise<number> {
  const text = input.text.replace(/\s+/g, " ").trim();

  if (text.length === 0) {
    await deleteChunksForSource(deps.db, input.pageId, input.sourceType, input.sourceId);
    return 0;
  }

  const chunks = chunkText(text);
  const vectors = await deps.embeddings.embed(chunks);

  await replaceChunksForSource(deps.db, {
    pageId: input.pageId,
    sourceType: input.sourceType,
    sourceId: input.sourceId,
    chunks: chunks.map((content, index) => ({
      content,
      embedding: vectors[index] ?? null,
    })),
  });

  return chunks.length;
}
