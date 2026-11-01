import {
  countChunksForPage,
  countPostsForPage,
  countProductsForPage,
  countUnembeddedChunksForPage,
  findPageById,
  listFaqsForPage,
  listPoliciesForPage,
  listProductsForPage,
} from "@fb-bot/db";
import { Hono } from "hono";
import { HTTPException } from "hono/http-exception";
import { db } from "../db.ts";
import { type AppEnv, requireSession } from "../middleware/auth.ts";
import { iso, resolveOwnedPageId } from "./page-scope.ts";

export const knowledgeRoute = new Hono<AppEnv>();

knowledgeRoute.use("*", requireSession);

knowledgeRoute.get("/", async (c) => {
  const user = c.get("user");
  const pageId = await resolveOwnedPageId(db, user.id, c.req.query("pageId"));
  const page = await findPageById(db, pageId);

  if (!page) {
    throw new HTTPException(404, { message: "Page not found" });
  }

  const [posts, products, drafts, faqs, policies, chunks, unembedded] = await Promise.all([
    countPostsForPage(db, pageId),
    countProductsForPage(db, pageId),
    listProductsForPage(db, pageId, { status: "draft" }),
    listFaqsForPage(db, pageId),
    listPoliciesForPage(db, pageId),
    countChunksForPage(db, pageId),
    countUnembeddedChunksForPage(db, pageId),
  ]);

  return c.json({
    pageId,
    posts,
    products,
    draftProducts: drafts.length,
    faqs: faqs.length,
    policies: policies.length,
    chunks,
    unembeddedChunks: unembedded,
    lastSyncedAt: iso(page.lastSyncedAt),
  });
});
