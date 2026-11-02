import {
  autoReplyRate,
  countAiReplies,
  findActiveSubscriptionWithPlan,
  getPageMetrics,
  periodStartFor,
} from "@fb-bot/db";
import { Hono } from "hono";
import { db } from "../db.ts";
import { env } from "../env.ts";
import { type AppEnv, requireSession } from "../middleware/auth.ts";
import { resolveOwnedPageId } from "./page-scope.ts";

export const dashboardRoute = new Hono<AppEnv>();

dashboardRoute.use("*", requireSession);

dashboardRoute.get("/", async (c) => {
  const user = c.get("user");
  const pageId = await resolveOwnedPageId(db, user.id, c.req.query("pageId"));

  const [metrics, subscription, used] = await Promise.all([
    getPageMetrics(db, pageId),
    findActiveSubscriptionWithPlan(db, user.id),
    countAiReplies(db, user.id, periodStartFor()),
  ]);

  return c.json({
    pageId,
    ...metrics,
    autoReplyRate: Number(autoReplyRate(metrics).toFixed(3)),
    usage: { used, limit: subscription?.aiRepliesPerMonth ?? env.DEFAULT_AI_REPLIES_LIMIT },
  });
});
