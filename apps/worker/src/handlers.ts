import { type IngestPageJob, QUEUES, type ReembedJob, type SyncPostsJob } from "@fb-bot/shared";
import type { PgBoss } from "pg-boss";
import { createDeps } from "./deps.ts";
import { ingestPage } from "./jobs/ingest-page.ts";
import { reembedSourceById } from "./jobs/reembed.ts";
import { syncPagePosts } from "./jobs/sync-posts.ts";

export async function registerHandlers(boss: PgBoss): Promise<void> {
  const deps = createDeps();

  await boss.work(QUEUES.ingestPage, async (jobs) => {
    const [job] = jobs;

    if (!job) {
      return;
    }

    const result = await ingestPage(deps, job.data as IngestPageJob);
    console.log(
      `[worker] ingest-page ${result.pageId}: ${result.posts} posts, ${result.products} products, ${result.chunks} chunks, ${result.extractionFailures} extraction failures`,
    );
  });

  await boss.work(QUEUES.syncPosts, async (jobs) => {
    const [job] = jobs;

    if (!job) {
      return;
    }

    const result = await syncPagePosts(deps, job.data as SyncPostsJob);
    console.log(
      `[worker] sync-posts ${result.pageId}: ${result.posts} posts, ${result.products} products, ${result.chunks} chunks`,
    );
  });

  await boss.work(QUEUES.reembed, async (jobs) => {
    const [job] = jobs;

    if (!job) {
      return;
    }

    const result = await reembedSourceById(deps, job.data as ReembedJob);
    console.log(
      `[worker] reembed ${result.sourceType}/${result.sourceId}: ${result.chunks} chunks${result.skipped ? " (source gone)" : ""}`,
    );
  });

  await boss.work(QUEUES.reply, async (jobs) => {
    console.log(`[worker] ${QUEUES.reply}: ${jobs.length} job(s), handled by the phase 6 pipeline`);
  });

  await boss.work(QUEUES.comment, async (jobs) => {
    console.log(`[worker] ${QUEUES.comment}: ${jobs.length} job(s), handled by phase 9`);
  });
}
