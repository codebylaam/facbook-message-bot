import { and, desc, eq } from "drizzle-orm";
import type { Db } from "../client.ts";
import { comments, customers } from "../schema/conversations.ts";
import type { commentReplyStatusEnum } from "../schema/enums.ts";

export type CommentReplyStatus = (typeof commentReplyStatusEnum.enumValues)[number];

export type NewComment = {
  pageId: string;
  fbCommentId: string;
  postId?: string | null;
  customerId?: string | null;
  text?: string | null;
};

export async function insertComment(db: Db, input: NewComment) {
  const [comment] = await db
    .insert(comments)
    .values({
      pageId: input.pageId,
      fbCommentId: input.fbCommentId,
      postId: input.postId ?? null,
      customerId: input.customerId ?? null,
      text: input.text ?? null,
    })
    .onConflictDoNothing({ target: comments.fbCommentId })
    .returning();

  return comment;
}

export async function findCommentByFbId(db: Db, fbCommentId: string) {
  const [comment] = await db
    .select()
    .from(comments)
    .where(eq(comments.fbCommentId, fbCommentId))
    .limit(1);

  return comment;
}

export async function findCommentById(db: Db, pageId: string, commentId: string) {
  const [comment] = await db
    .select()
    .from(comments)
    .where(and(eq(comments.pageId, pageId), eq(comments.id, commentId)))
    .limit(1);

  return comment;
}

export async function setCommentClassification(db: Db, commentId: string, classification: string) {
  const [comment] = await db
    .update(comments)
    .set({ classification, updatedAt: new Date() })
    .where(eq(comments.id, commentId))
    .returning();

  return comment;
}

export async function setCommentReplyStatus(
  db: Db,
  commentId: string,
  status: CommentReplyStatus,
  mids?: { privateReplyMid?: string | null; publicReplyMid?: string | null },
) {
  const [comment] = await db
    .update(comments)
    .set({
      replyStatus: status,
      ...(mids?.privateReplyMid === undefined ? {} : { privateReplyMid: mids.privateReplyMid }),
      ...(mids?.publicReplyMid === undefined ? {} : { publicReplyMid: mids.publicReplyMid }),
      updatedAt: new Date(),
    })
    .where(eq(comments.id, commentId))
    .returning();

  return comment;
}

export async function listCommentsForPage(
  db: Db,
  pageId: string,
  options: { status?: CommentReplyStatus; limit?: number } = {},
) {
  const filters = [eq(comments.pageId, pageId)];

  if (options.status) {
    filters.push(eq(comments.replyStatus, options.status));
  }

  return db
    .select({
      id: comments.id,
      pageId: comments.pageId,
      fbCommentId: comments.fbCommentId,
      postId: comments.postId,
      customerId: comments.customerId,
      customerName: customers.name,
      text: comments.text,
      classification: comments.classification,
      replyStatus: comments.replyStatus,
      privateReplyMid: comments.privateReplyMid,
      publicReplyMid: comments.publicReplyMid,
      createdAt: comments.createdAt,
    })
    .from(comments)
    .leftJoin(customers, eq(comments.customerId, customers.id))
    .where(and(...filters))
    .orderBy(desc(comments.createdAt))
    .limit(options.limit ?? 50);
}

export async function findCommentByIdOnly(db: Db, commentId: string) {
  const [comment] = await db.select().from(comments).where(eq(comments.id, commentId)).limit(1);

  return comment;
}
