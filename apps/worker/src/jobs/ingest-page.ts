import { findPageById, markPageSynced, upsertPageProfile } from "@fb-bot/db";
import {
  decryptToken,
  fetchPagePosts,
  fetchPageProfile,
  lookbackDate,
  profileLines,
} from "@fb-bot/meta";
import type { IngestPageJob } from "@fb-bot/shared";
import type { WorkerDeps } from "../deps.ts";
import { reembedSource } from "../ingest/embed.ts";
import { embedStandaloneKnowledge } from "../ingest/knowledge.ts";
import { syncPosts } from "../ingest/sync-posts.ts";

export type IngestPageResult = {
  pageId: string;
  posts: number;
  products: number;
  chunks: number;
  extractionFailures: number;
};

export async function ingestPage(deps: WorkerDeps, job: IngestPageJob): Promise<IngestPageResult> {
  const page = await findPageById(deps.db, job.pageId);

  if (!page) {
    throw new Error(`page ${job.pageId} no longer exists`);
  }

  const pageAccessToken = decryptToken(page.accessTokenEncrypted, deps.encryptionKey);
  const graphOptions = { pageId: page.fbPageId, pageAccessToken };

  const profile = await fetchPageProfile(deps.graphApi, graphOptions);
  const storedProfile = await upsertPageProfile(deps.db, page.id, profile);

  let chunks = 0;

  if (storedProfile) {
    chunks += await reembedSource(deps, {
      pageId: page.id,
      sourceType: "page_profile",
      sourceId: storedProfile.id,
      text: profileLines(profile).join("\n"),
    });
  }

  const posts = await fetchPagePosts(deps.graphApi, {
    ...graphOptions,
    since: lookbackDate(new Date()),
  });

  const synced = await syncPosts(deps, page.id, posts);
  chunks += synced.chunks;
  chunks += await embedStandaloneKnowledge(deps, page.id);

  await markPageSynced(deps.db, page.id);

  return {
    pageId: page.id,
    posts: synced.posts,
    products: synced.products,
    chunks,
    extractionFailures: synced.extractionFailures,
  };
}
