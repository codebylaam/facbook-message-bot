import { and, asc, desc, eq, gte } from "drizzle-orm";
import type { Db } from "../client.ts";
import { users } from "../schema/auth.ts";
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

export async function listPlans(db: Db) {
  return db.select().from(plans).orderBy(asc(plans.aiRepliesPerMonth));
}

export async function findPlanByName(db: Db, name: string) {
  const [plan] = await db.select().from(plans).where(eq(plans.name, name)).limit(1);

  return plan;
}

export async function upsertPlan(
  db: Db,
  input: { name: string; aiRepliesPerMonth: number; pageLimit: number; price: string },
) {
  const [plan] = await db
    .insert(plans)
    .values(input)
    .onConflictDoUpdate({
      target: plans.name,
      set: {
        aiRepliesPerMonth: input.aiRepliesPerMonth,
        pageLimit: input.pageLimit,
        price: input.price,
        updatedAt: new Date(),
      },
    })
    .returning();

  return plan;
}

export async function findSubscriptionForOwner(db: Db, ownerId: string) {
  const [row] = await db
    .select({
      id: subscriptions.id,
      planId: plans.id,
      planName: plans.name,
      aiRepliesPerMonth: plans.aiRepliesPerMonth,
      pageLimit: plans.pageLimit,
      price: plans.price,
      status: subscriptions.status,
      periodStart: subscriptions.periodStart,
      periodEnd: subscriptions.periodEnd,
    })
    .from(subscriptions)
    .innerJoin(plans, eq(subscriptions.planId, plans.id))
    .where(eq(subscriptions.ownerId, ownerId))
    .limit(1);

  return row ?? null;
}

/** One subscription per seller: assigning again replaces the current period. */
export async function assignPlanToOwner(
  db: Db,
  input: { ownerId: string; planId: string; periodStart: Date; periodEnd: Date },
) {
  return db.transaction(async (tx) => {
    const [existing] = await tx
      .select({ id: subscriptions.id })
      .from(subscriptions)
      .where(eq(subscriptions.ownerId, input.ownerId))
      .limit(1);

    const values = {
      planId: input.planId,
      status: "active" as const,
      periodStart: input.periodStart,
      periodEnd: input.periodEnd,
    };

    if (existing) {
      const [updated] = await tx
        .update(subscriptions)
        .set({ ...values, updatedAt: new Date() })
        .where(eq(subscriptions.id, existing.id))
        .returning();

      return updated;
    }

    const [created] = await tx
      .insert(subscriptions)
      .values({ ownerId: input.ownerId, ...values })
      .returning();

    return created;
  });
}

export async function expireSubscription(db: Db, ownerId: string) {
  const [row] = await db
    .update(subscriptions)
    .set({ status: "expired", updatedAt: new Date() })
    .where(eq(subscriptions.ownerId, ownerId))
    .returning();

  return row;
}

export async function listUsersWithPlan(db: Db, options: { limit?: number; offset?: number } = {}) {
  return db
    .select({
      id: users.id,
      name: users.name,
      email: users.email,
      role: users.role,
      createdAt: users.createdAt,
      planName: plans.name,
      aiRepliesPerMonth: plans.aiRepliesPerMonth,
      subscriptionStatus: subscriptions.status,
      periodEnd: subscriptions.periodEnd,
    })
    .from(users)
    .leftJoin(subscriptions, eq(subscriptions.ownerId, users.id))
    .leftJoin(plans, eq(subscriptions.planId, plans.id))
    .orderBy(desc(users.createdAt))
    .limit(options.limit ?? 50)
    .offset(options.offset ?? 0);
}

export async function setUserRole(db: Db, userId: string, role: "seller" | "admin") {
  const [user] = await db
    .update(users)
    .set({ role, updatedAt: new Date() })
    .where(eq(users.id, userId))
    .returning();

  return user;
}
