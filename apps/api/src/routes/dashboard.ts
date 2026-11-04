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
import { resolveOptionalPageId } from "./page-scope.ts";

export const dashboardRoute = new Hono<AppEnv>();

dashboardRoute.use("*", requireSession);

dashboardRoute.get("/", async (c) => {
  const user = c.get("user");
  const pageId = await resolveOptionalPageId(db, user.id, c.req.query("pageId"));

  const [subscription, used] = await Promise.all([
    findActiveSubscriptionWithPlan(db, user.id),
    countAiReplies(db, user.id, periodStartFor()),
  ]);

  const usage = { used, limit: subscription?.aiRepliesPerMonth ?? env.DEFAULT_AI_REPLIES_LIMIT };

  // A seller lands here straight after signing up, before any Page is connected.
  if (!pageId) {
    return c.json({
      pageId: null,
      conversations: 0,
      inHumanMode: 0,
      inboundMessages: 0,
      botMessages: 0,
      humanMessages: 0,
      leads: 0,
      draftProducts: 0,
      autoReplyRate: 0,
      usage,
    });
  }

  const metrics = await getPageMetrics(db, pageId);

  return c.json({
    pageId,
    ...metrics,
    autoReplyRate: Number(autoReplyRate(metrics).toFixed(3)),
    usage,
  });
});
