import { hybridSearch, type ReplyKnowledge, type Retrieve, type RetrievedChunk } from "@fb-bot/ai";
import { type Db, findPageProfile, listPoliciesForPage } from "@fb-bot/db";
import { profileLines } from "@fb-bot/meta";
import type { WorkerDeps } from "./deps.ts";

type PageRow = NonNullable<Awaited<ReturnType<typeof import("@fb-bot/db").findPageById>>>;

export async function loadReplyKnowledge(db: Db, page: PageRow): Promise<ReplyKnowledge> {
  const [profile, policies] = await Promise.all([
    findPageProfile(db, page.id),
    listPoliciesForPage(db, page.id),
  ]);

  return {
    pageName: page.name,
    persona: page.persona,
    profileLines: profile ? profileLines(profile) : [],
    policies: policies.map((policy) => ({ title: policy.title, content: policy.content })),
  };
}

/** Embeds the query when a provider is configured, otherwise searches by text. */
export function makeRetriever(deps: WorkerDeps, pageId: string): Retrieve {
  return async (query: string): Promise<RetrievedChunk[]> => {
    let embedding: number[] | null = null;

    if (deps.embeddings) {
      try {
        embedding = await deps.embeddings.embedOne(query);
      } catch (error) {
        console.warn("[worker] embedding the query failed, searching by text only", error);
      }
    }

    return hybridSearch(deps.db, { pageId, query, embedding });
  };
}
