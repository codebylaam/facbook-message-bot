import {
  type Db,
  findCommentByFbId,
  findOrCreateCustomer,
  findPageByFbPageId,
  findPostForPage,
  insertComment,
} from "@fb-bot/db";
import type { WebhookEntry } from "@fb-bot/meta";

export type FeedDeps = {
  db: Db;
  enqueueComment: (commentId: string) => Promise<void>;
  enqueuePostSync: (pageId: string) => Promise<void>;
};

export type FeedResult = {
  stored: number;
  enqueued: number;
  duplicates: number;
  skipped: number;
  postSyncs: number;
  reason?: string;
};

export async function handleFeedEntry(deps: FeedDeps, entry: WebhookEntry): Promise<FeedResult> {
  const result: FeedResult = {
    stored: 0,
    enqueued: 0,
    duplicates: 0,
    skipped: 0,
    postSyncs: 0,
  };

  const page = await findPageByFbPageId(deps.db, entry.id);

  if (!page) {
    return { ...result, skipped: 1, reason: "the page is not connected to this app" };
  }

  for (const change of entry.changes ?? []) {
    if (change.field !== "feed") {
      result.skipped += 1;
      continue;
    }

    const value = change.value;

    // A new or edited post means the knowledge is stale, so re-sync the Page.
    if (value.item !== "comment" && (value.verb === "add" || value.verb === "edited")) {
      await deps.enqueuePostSync(page.id);
      result.skipped += 1;
      result.postSyncs += 1;
      continue;
    }

    // Feed also carries likes, removals and other noise.
    if (value.item !== "comment" || value.verb !== "add" || !value.comment_id) {
      result.skipped += 1;
      continue;
    }

    if (await findCommentByFbId(deps.db, value.comment_id)) {
      result.duplicates += 1;
      continue;
    }

    const post = value.post_id ? await findPostForPage(deps.db, page.id, value.post_id) : undefined;

    const customer = value.from?.id
      ? await findOrCreateCustomer(deps.db, page.id, value.from.id, value.from.name ?? null)
      : null;

    const comment = await insertComment(deps.db, {
      pageId: page.id,
      fbCommentId: value.comment_id,
      postId: post?.id ?? null,
      customerId: customer?.id ?? null,
      text: value.message ?? null,
    });

    if (!comment) {
      result.duplicates += 1;
      continue;
    }

    await deps.enqueueComment(comment.id);
    result.stored += 1;
    result.enqueued += 1;
  }

  return result;
}
