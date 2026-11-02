import { type IngestPageJob, QUEUES, type ReembedJob, type SyncPostsJob } from "@fb-bot/shared";
import type { PgBoss } from "pg-boss";
import { createDeps } from "./deps.ts";
import { type CommentJob, handleComment } from "./jobs/comment.ts";
import { ingestPage } from "./jobs/ingest-page.ts";
import { reembedSourceById } from "./jobs/reembed.ts";
import { handleReply, type ReplyJob } from "./jobs/reply.ts";
import { syncPagePosts } from "./jobs/sync-posts.ts";
import { logger } from "./logger.ts";

export async function registerHandlers(boss: PgBoss): Promise<void> {
  const deps = createDeps();

  const enqueueReply = async (conversationId: string) => {
    await boss.send(QUEUES.reply, { conversationId });
  };

  await boss.work(QUEUES.ingestPage, async (jobs) => {
    const [job] = jobs;

    if (!job) {
      return;
    }

    const result = await ingestPage(deps, job.data as IngestPageJob);
    logger.info(
      `[worker] ingest-page ${result.pageId}: ${result.posts} posts, ${result.products} products, ${result.chunks} chunks, ${result.extractionFailures} extraction failures`,
    );
  });

  await boss.work(QUEUES.syncPosts, async (jobs) => {
    const [job] = jobs;

    if (!job) {
      return;
    }

    const result = await syncPagePosts(deps, job.data as SyncPostsJob);
    logger.info(
      `[worker] sync-posts ${result.pageId}: ${result.posts} posts, ${result.products} products, ${result.chunks} chunks`,
    );
  });

  await boss.work(QUEUES.reembed, async (jobs) => {
    const [job] = jobs;

    if (!job) {
      return;
    }

    const result = await reembedSourceById(deps, job.data as ReembedJob);
    logger.info(
      `[worker] reembed ${result.sourceType}/${result.sourceId}: ${result.chunks} chunks${result.skipped ? " (source gone)" : ""}`,
    );
  });

  await boss.work(QUEUES.reply, async (jobs) => {
    const [job] = jobs;

    if (!job) {
      return;
    }

    const result = await handleReply(deps, job.data as ReplyJob, { enqueueReply });
    logger.info(
      `[worker] reply ${result.conversationId}: ${result.action}${result.reason ? ` (${result.reason})` : ""}`,
    );
  });

  await boss.work(QUEUES.comment, async (jobs) => {
    const [job] = jobs;

    if (!job) {
      return;
    }

    const result = await handleComment(deps, job.data as CommentJob);
    logger.info(
      `[worker] comment ${result.commentId}: ${result.action}${result.reason ? ` (${result.reason})` : ""}`,
    );
  });
}
