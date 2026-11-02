import {
  classifyCommentWithFallback,
  isAnswerable,
  PUBLIC_REPLY_TEXT,
  runReplyEngine,
} from "@fb-bot/ai";
import {
  countAiReplies,
  findActiveSubscriptionWithPlan,
  findCommentByIdOnly,
  findPageById,
  findPostById,
  incrementAiReplies,
  periodStartFor,
  setCommentClassification,
  setCommentReplyStatus,
} from "@fb-bot/db";
import { decryptToken, replyToComment, sendPrivateReply } from "@fb-bot/meta";
import { loadReplyKnowledge, makeRetriever } from "../ai-context.ts";
import type { WorkerDeps } from "../deps.ts";
import { env } from "../env.ts";
import { guardGraphCall } from "../graph-guard.ts";
import { notifyInbox } from "../inbox-events.ts";
import { logger } from "../logger.ts";

export type CommentJob = { commentId: string };

export type CommentJobResult = {
  commentId: string;
  action: "private_replied" | "public_replied" | "flagged" | "ignored" | "skipped";
  reason?: string;
};

export async function handleComment(deps: WorkerDeps, job: CommentJob): Promise<CommentJobResult> {
  const comment = await findCommentByIdOnly(deps.db, job.commentId);

  if (!comment) {
    return { commentId: job.commentId, action: "skipped", reason: "the comment no longer exists" };
  }

  const page = await findPageById(deps.db, comment.pageId);

  if (!page) {
    return { commentId: comment.id, action: "skipped", reason: "the page no longer exists" };
  }

  if (comment.replyStatus === "private_replied" || comment.replyStatus === "public_replied") {
    return {
      commentId: comment.id,
      action: "skipped",
      reason: "this comment was already answered",
    };
  }

  if (page.commentMode === "off") {
    await setCommentReplyStatus(deps.db, comment.id, "ignored");
    return {
      commentId: comment.id,
      action: "ignored",
      reason: "comment replies are turned off for this Page",
    };
  }

  const text = comment.text?.trim() ?? "";

  if (text.length === 0) {
    await setCommentReplyStatus(deps.db, comment.id, "ignored");
    return { commentId: comment.id, action: "ignored", reason: "the comment has no text" };
  }

  const post = comment.postId ? await findPostById(deps.db, page.id, comment.postId) : undefined;
  const classification = await classifyCommentWithFallback(deps.llm, {
    text,
    postMessage: post?.message ?? null,
  });

  await setCommentClassification(deps.db, comment.id, classification.kind);

  if (classification.kind === "spam") {
    await setCommentReplyStatus(deps.db, comment.id, "ignored");
    return { commentId: comment.id, action: "ignored", reason: "classified as spam" };
  }

  if (classification.kind === "complaint") {
    await setCommentReplyStatus(deps.db, comment.id, "flagged");
    await notifyInbox(deps.db, {
      pageId: page.id,
      commentId: comment.id,
      kind: "comment",
      reason: "The customer is complaining",
    });

    return { commentId: comment.id, action: "flagged", reason: "the customer is complaining" };
  }

  if (!isAnswerable(classification.kind)) {
    await setCommentReplyStatus(deps.db, comment.id, "ignored");
    return {
      commentId: comment.id,
      action: "ignored",
      reason: `classified as ${classification.kind}`,
    };
  }

  const period = periodStartFor();
  const [used, subscription] = await Promise.all([
    countAiReplies(deps.db, page.ownerId, period),
    findActiveSubscriptionWithPlan(deps.db, page.ownerId),
  ]);
  const limit = subscription?.aiRepliesPerMonth ?? env.DEFAULT_AI_REPLIES_LIMIT;

  if (used >= limit) {
    await setCommentReplyStatus(deps.db, comment.id, "flagged");
    return {
      commentId: comment.id,
      action: "flagged",
      reason: `The plan allows ${limit} AI replies this month and all of them are used`,
    };
  }

  const pageAccessToken = decryptToken(page.accessTokenEncrypted, deps.encryptionKey);
  const knowledge = await loadReplyKnowledge(deps.db, page);

  const result = await runReplyEngine({
    llm: deps.llm,
    knowledge,
    retrieve: makeRetriever(deps, page.id),
    message: text,
    confidenceThreshold: page.confidenceThreshold,
    history: [],
    summary: null,
  });

  await incrementAiReplies(deps.db, page.ownerId, period);

  if (result.decision.action === "handoff") {
    await setCommentReplyStatus(deps.db, comment.id, "flagged");
    await notifyInbox(deps.db, {
      pageId: page.id,
      commentId: comment.id,
      kind: "comment",
      reason: result.decision.reason,
    });

    return { commentId: comment.id, action: "flagged", reason: result.decision.reason };
  }

  let privateReply: Awaited<ReturnType<typeof sendPrivateReply>>;
  const replyText = result.decision.reply;

  try {
    privateReply = await guardGraphCall(deps, page, () =>
      sendPrivateReply(deps.graphApi, {
        pageId: page.fbPageId,
        pageAccessToken,
        commentId: comment.fbCommentId,
        text: replyText,
      }),
    );
  } catch (error) {
    // Flag it so the seller sees the comment, then rethrow so the job still retries.
    await setCommentReplyStatus(deps.db, comment.id, "flagged");
    throw error;
  }

  let publicReplyMid: string | null = null;
  let action: "private_replied" | "public_replied" = "private_replied";

  if (page.commentMode === "private_public") {
    try {
      const published = await guardGraphCall(deps, page, () =>
        replyToComment(deps.graphApi, {
          commentId: comment.fbCommentId,
          pageAccessToken,
          message: PUBLIC_REPLY_TEXT,
        }),
      );

      if (published.commentId) {
        publicReplyMid = published.commentId;
        action = "public_replied";
      }
    } catch (error) {
      // The private reply already reached the customer, so this is not fatal.
      logger.warn(
        { err: error },
        "[worker] the public comment reply failed, the private one was sent",
      );
    }
  }

  await setCommentReplyStatus(deps.db, comment.id, action, {
    privateReplyMid: privateReply.messageId,
    publicReplyMid,
  });

  return { commentId: comment.id, action };
}
