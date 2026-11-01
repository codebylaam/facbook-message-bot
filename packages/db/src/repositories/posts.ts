import { and, count, desc, eq } from "drizzle-orm";
import type { Db } from "../client.ts";
import { posts } from "../schema/knowledge.ts";

export type NewPost = {
  fbPostId: string;
  message: string | null;
  permalink: string | null;
  images: string[];
  fbCreatedTime: Date | null;
};

export async function upsertPostForPage(db: Db, pageId: string, input: NewPost) {
  const [post] = await db
    .insert(posts)
    .values({ pageId, ...input })
    .onConflictDoUpdate({
      target: posts.fbPostId,
      set: {
        message: input.message,
        permalink: input.permalink,
        images: input.images,
        fbCreatedTime: input.fbCreatedTime,
        updatedAt: new Date(),
      },
    })
    .returning();

  return post;
}

export async function listPostsForPage(
  db: Db,
  pageId: string,
  options: { onlyIncluded?: boolean; limit?: number } = {},
) {
  const where = options.onlyIncluded
    ? and(eq(posts.pageId, pageId), eq(posts.included, true))
    : eq(posts.pageId, pageId);

  const query = db.select().from(posts).where(where).orderBy(desc(posts.fbCreatedTime));

  return options.limit === undefined ? query : query.limit(options.limit);
}

export async function countPostsForPage(db: Db, pageId: string) {
  const [row] = await db.select({ total: count() }).from(posts).where(eq(posts.pageId, pageId));

  return row?.total ?? 0;
}

export async function setPostIncluded(db: Db, pageId: string, postId: string, included: boolean) {
  const [post] = await db
    .update(posts)
    .set({ included, updatedAt: new Date() })
    .where(and(eq(posts.id, postId), eq(posts.pageId, pageId)))
    .returning();

  return post;
}

export async function findPostForPage(db: Db, pageId: string, fbPostId: string) {
  const [post] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.pageId, pageId), eq(posts.fbPostId, fbPostId)))
    .limit(1);

  return post;
}

export async function findPostById(db: Db, pageId: string, postId: string) {
  const [post] = await db
    .select()
    .from(posts)
    .where(and(eq(posts.pageId, pageId), eq(posts.id, postId)))
    .limit(1);

  return post;
}
