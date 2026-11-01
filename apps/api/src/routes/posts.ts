import {
  deleteChunksForSource,
  listExtractedProductsForPost,
  listPostsForPage,
  setPostIncluded,
} from "@fb-bot/db";
import { QUEUES, updatePostSchema } from "@fb-bot/shared";
import { zValidator } from "@hono/zod-validator";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { db } from "../db.ts";
import { type AppEnv, requireSession } from "../middleware/auth.ts";
import { enqueue } from "../queue.ts";
import { iso, resolveOwnedPageId } from "./page-scope.ts";

export const postsRoute = new Hono<AppEnv>();

postsRoute.use("*", requireSession);

type PostRow = Awaited<ReturnType<typeof listPostsForPage>>[number];

function toPost(row: PostRow) {
  return {
    id: row.id,
    fbPostId: row.fbPostId,
    message: row.message,
    permalink: row.permalink,
    images: row.images,
    included: row.included,
    fbCreatedTime: iso(row.fbCreatedTime),
    createdAt: row.createdAt.toISOString(),
  };
}

postsRoute.get("/", async (c) => {
  const user = c.get("user");
  const pageId = await resolveOwnedPageId(db, user.id, c.req.query("pageId"));
  const rows = await listPostsForPage(db, pageId);

  return c.json({ pageId, posts: rows.map(toPost) });
});

postsRoute.patch("/:id", zValidator("json", updatePostSchema), async (c) => {
  const user = c.get("user");
  const pageId = await resolveOwnedPageId(db, user.id, c.req.query("pageId"));
  const { included } = c.req.valid("json");

  const post = await setPostIncluded(db, pageId, c.req.param("id"), included);

  if (!post) {
    throw new HTTPException(404, { message: "Post not found" });
  }

  if (included) {
    await enqueue(QUEUES.reembed, { pageId, sourceType: "post", sourceId: post.id });
  } else {
    await deleteChunksForSource(db, pageId, "post", post.id);

    for (const product of await listExtractedProductsForPost(db, pageId, post.id)) {
      await deleteChunksForSource(db, pageId, "product", product.id);
    }
  }

  return c.json({ post: toPost(post) });
});
