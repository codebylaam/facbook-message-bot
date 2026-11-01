import { listCommentsForPage } from "@fb-bot/db";
import { Hono } from "hono";
import { db } from "../db.ts";
import { type AppEnv, requireSession } from "../middleware/auth.ts";
import { resolveOwnedPageId } from "./page-scope.ts";

export const commentsRoute = new Hono<AppEnv>();

commentsRoute.use("*", requireSession);

const STATUSES = ["pending", "private_replied", "public_replied", "flagged", "ignored"] as const;

type Status = (typeof STATUSES)[number];

function parseStatus(value: string | undefined): Status | undefined {
  return STATUSES.find((status) => status === value);
}

commentsRoute.get("/", async (c) => {
  const user = c.get("user");
  const pageId = await resolveOwnedPageId(db, user.id, c.req.query("pageId"));
  const status = parseStatus(c.req.query("status"));

  const rows = await listCommentsForPage(db, pageId, {
    ...(status ? { status } : {}),
    limit: 100,
  });

  return c.json({
    pageId,
    comments: rows.map((row) => ({
      id: row.id,
      pageId: row.pageId,
      fbCommentId: row.fbCommentId,
      postId: row.postId,
      customerId: row.customerId,
      customerName: row.customerName,
      text: row.text,
      classification: row.classification,
      replyStatus: row.replyStatus,
      privateReplyMid: row.privateReplyMid,
      publicReplyMid: row.publicReplyMid,
      createdAt: row.createdAt.toISOString(),
    })),
  });
});
