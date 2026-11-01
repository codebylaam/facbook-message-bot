import { and, eq, gte } from "drizzle-orm";
import type { Db } from "../client.ts";
import { plans, subscriptions } from "../schema/billing.ts";

export type ActiveSubscription = {
  subscriptionId: string;
  planId: string;
  planName: string;
  aiRepliesPerMonth: number;
  pageLimit: number;
  periodEnd: Date;
};

export async function findActiveSubscriptionWithPlan(
  db: Db,
  ownerId: string,
  now = new Date(),
): Promise<ActiveSubscription | null> {
  const [row] = await db
    .select({
      subscriptionId: subscriptions.id,
      planId: plans.id,
      planName: plans.name,
      aiRepliesPerMonth: plans.aiRepliesPerMonth,
      pageLimit: plans.pageLimit,
      periodEnd: subscriptions.periodEnd,
    })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(
      and(
        eq(subscriptions.ownerId, ownerId),
        eq(subscriptions.status, "active"),
        gte(subscriptions.periodEnd, now),
      ),
    )
    .limit(1);

  return row ?? null;
}
