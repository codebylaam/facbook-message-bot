import type { Db } from "@fb-bot/db";
import { sql } from "drizzle-orm";

export type RetrievedChunk = {
  id: string;
  content: string;
  sourceType: string;
  sourceId: string | null;
  score: number;
  vectorRank: number | null;
  textRank: number | null;
  trigramRank: number | null;
};

export type HybridSearchInput = {
  pageId: string;
  query: string;
  embedding?: number[] | null;
  limit?: number;
  candidateLimit?: number;
  rrfK?: number;
};

export const DEFAULT_RESULT_LIMIT = 8;
export const DEFAULT_CANDIDATE_LIMIT = 40;
export const DEFAULT_RRF_K = 60;

function toVectorLiteral(embedding: number[]): string {
  return `[${embedding.join(",")}]`;
}

export async function hybridSearch(db: Db, input: HybridSearchInput): Promise<RetrievedChunk[]> {
  const limit = input.limit ?? DEFAULT_RESULT_LIMIT;
  const candidateLimit = input.candidateLimit ?? DEFAULT_CANDIDATE_LIMIT;
  const rrfK = input.rrfK ?? DEFAULT_RRF_K;
  const embedding = input.embedding ?? null;
  const vector = embedding ? toVectorLiteral(embedding) : "";

  // Without an embedding the search degrades to full-text plus trigram, which keeps
  // the playground and any embeddings outage usable instead of failing the request.
  const vectorCte = embedding
    ? sql`vector_hits as (
        select id, (row_number() over (order by embedding <=> ${vector}::vector))::int as rank
        from knowledge_chunks
        where page_id = ${input.pageId} and embedding is not null
        order by embedding <=> ${vector}::vector
        limit ${candidateLimit}
      ),`
    : sql``;

  const vectorUnion = embedding
    ? sql`union all select id, rank, 'vector' as source from vector_hits`
    : sql``;

  const rows = await db.execute(sql`
    with ${vectorCte}
    text_hits as (
      select id, (row_number() over (
        order by ts_rank_cd(tsv, plainto_tsquery('simple', ${input.query})) desc
      ))::int as rank
      from knowledge_chunks
      where page_id = ${input.pageId} and tsv @@ plainto_tsquery('simple', ${input.query})
      limit ${candidateLimit}
    ),
    trigram_hits as (
      select id, (row_number() over (order by similarity(content, ${input.query}) desc))::int as rank
      from knowledge_chunks
      where page_id = ${input.pageId} and content % ${input.query}
      limit ${candidateLimit}
    ),
    all_hits as (
      select id, rank, 'text' as source from text_hits
      union all
      select id, rank, 'trigram' as source from trigram_hits
      ${vectorUnion}
    ),
    fused as (
      select
        id,
        (sum(1.0 / (${rrfK} + rank)))::float8 as score,
        (min(rank) filter (where source = 'vector'))::int as vector_rank,
        (min(rank) filter (where source = 'text'))::int as text_rank,
        (min(rank) filter (where source = 'trigram'))::int as trigram_rank
      from all_hits
      group by id
    )
    select
      c.id,
      c.content,
      c.source_type,
      c.source_id,
      f.score,
      f.vector_rank,
      f.text_rank,
      f.trigram_rank
    from fused f
    join knowledge_chunks c on c.id = f.id
    order by f.score desc, c.id
    limit ${limit}
  `);

  return rows.map((row) => ({
    id: String(row.id),
    content: String(row.content),
    sourceType: String(row.source_type),
    sourceId: row.source_id === null ? null : String(row.source_id),
    score: Number(row.score),
    vectorRank: row.vector_rank === null ? null : Number(row.vector_rank),
    textRank: row.text_rank === null ? null : Number(row.text_rank),
    trigramRank: row.trigram_rank === null ? null : Number(row.trigram_rank),
  }));
}
