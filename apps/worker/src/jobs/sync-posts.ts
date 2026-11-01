import { findPageById, markPageSynced } from "@fb-bot/db";
import { decryptToken, fetchPagePosts, lookbackDate } from "@fb-bot/meta";
import type { SyncPostsJob } from "@fb-bot/shared";
import type { WorkerDeps } from "../deps.ts";
import { syncPosts } from "../ingest/sync-posts.ts";
import type { IngestPageResult } from "./ingest-page.ts";

export async function syncPagePosts(
  deps: WorkerDeps,
  job: SyncPostsJob,
): Promise<IngestPageResult> {
  const page = await findPageById(deps.db, job.pageId);

  if (!page) {
    throw new Error(`page ${job.pageId} no longer exists`);
  }

  const pageAccessToken = decryptToken(page.accessTokenEncrypted, deps.encryptionKey);

  const posts = await fetchPagePosts(deps.graphApi, {
    pageId: page.fbPageId,
    pageAccessToken,
    since: lookbackDate(new Date()),
  });

  const synced = await syncPosts(deps, page.id, posts);

  await markPageSynced(deps.db, page.id);

  return {
    pageId: page.id,
    posts: synced.posts,
    products: synced.products,
    chunks: synced.chunks,
    extractionFailures: synced.extractionFailures,
  };
}
