import { and, count, eq, isNull, type SQL } from "drizzle-orm";
import type { Db } from "../client.ts";
import type { knowledgeSourceEnum } from "../schema/enums.ts";
import { knowledgeChunks } from "../schema/knowledge.ts";

export type KnowledgeSource = (typeof knowledgeSourceEnum.enumValues)[number];

export type ChunkInput = {
  content: string;
  embedding: number[] | null;
};

function sourceFilter(pageId: string, sourceType: KnowledgeSource, sourceId: string | null): SQL {
  const source =
    sourceId === null ? isNull(knowledgeChunks.sourceId) : eq(knowledgeChunks.sourceId, sourceId);

  const where = and(
    eq(knowledgeChunks.pageId, pageId),
    eq(knowledgeChunks.sourceType, sourceType),
    source,
  );

  if (!where) {
    throw new Error("failed to build the knowledge chunk source filter");
  }

  return where;
}

export async function replaceChunksForSource(
  db: Db,
  input: {
    pageId: string;
    sourceType: KnowledgeSource;
    sourceId: string | null;
    chunks: ChunkInput[];
  },
) {
  const where = sourceFilter(input.pageId, input.sourceType, input.sourceId);

  return db.transaction(async (tx) => {
    await tx.delete(knowledgeChunks).where(where);

    if (input.chunks.length === 0) {
      return [];
    }

    return tx
      .insert(knowledgeChunks)
      .values(
        input.chunks.map((chunk) => ({
          pageId: input.pageId,
          sourceType: input.sourceType,
          sourceId: input.sourceId,
          content: chunk.content,
          embedding: chunk.embedding,
        })),
      )
      .returning({ id: knowledgeChunks.id });
  });
}

export async function deleteChunksForSource(
  db: Db,
  pageId: string,
  sourceType: KnowledgeSource,
  sourceId: string | null,
) {
  const deleted = await db
    .delete(knowledgeChunks)
    .where(sourceFilter(pageId, sourceType, sourceId))
    .returning({ id: knowledgeChunks.id });

  return deleted.length;
}

export async function countChunksForPage(db: Db, pageId: string) {
  const [row] = await db
    .select({ total: count() })
    .from(knowledgeChunks)
    .where(eq(knowledgeChunks.pageId, pageId));

  return row?.total ?? 0;
}

export async function countUnembeddedChunksForPage(db: Db, pageId: string) {
  const [row] = await db
    .select({ total: count() })
    .from(knowledgeChunks)
    .where(and(eq(knowledgeChunks.pageId, pageId), isNull(knowledgeChunks.embedding)));

  return row?.total ?? 0;
}

export async function listChunksForPage(db: Db, pageId: string, limit = 100) {
  return db
    .select({
      id: knowledgeChunks.id,
      sourceType: knowledgeChunks.sourceType,
      sourceId: knowledgeChunks.sourceId,
      content: knowledgeChunks.content,
    })
    .from(knowledgeChunks)
    .where(eq(knowledgeChunks.pageId, pageId))
    .limit(limit);
}
