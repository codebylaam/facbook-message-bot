import {
  countAiReplies,
  findSubscriptionForOwner,
  listPagesForOwner,
  periodStartFor,
} from "@fb-bot/db";
import { Hono } from "hono";
import { db } from "../db.ts";
import { env } from "../env.ts";
import { type AppEnv, requireSession } from "../middleware/auth.ts";

export const billingRoute = new Hono<AppEnv>();

billingRoute.use("*", requireSession);

billingRoute.get("/", async (c) => {
  const user = c.get("user");

  const [subscription, pages, used] = await Promise.all([
    findSubscriptionForOwner(db, user.id),
    listPagesForOwner(db, user.id),
    countAiReplies(db, user.id, periodStartFor()),
  ]);

  const limit = subscription?.aiRepliesPerMonth ?? env.DEFAULT_AI_REPLIES_LIMIT;

  return c.json({
    hasPlan: subscription !== null,
    planName: subscription?.planName ?? null,
    aiRepliesPerMonth: limit,
    pageLimit: subscription?.pageLimit ?? 1,
    price: subscription?.price ?? null,
    status: subscription?.status ?? null,
    periodStart: subscription?.periodStart?.toISOString() ?? null,
    periodEnd: subscription?.periodEnd?.toISOString() ?? null,
    used,
    remaining: Math.max(0, limit - used),
    paused: used >= limit,
    pagesUsed: pages.length,
  });
});
