import { and, eq, sql } from "drizzle-orm";
import type { Db } from "../client.ts";
import { usageCounters } from "../schema/billing.ts";

/** The first day of the current month, as the date column stores it. */
export function periodStartFor(date = new Date()): string {
  const first = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1));

  return first.toISOString().slice(0, 10);
}

export async function getUsageForPeriod(db: Db, ownerId: string, periodStart: string) {
  const [row] = await db
    .select()
    .from(usageCounters)
    .where(and(eq(usageCounters.ownerId, ownerId), eq(usageCounters.periodStart, periodStart)))
    .limit(1);

  return row;
}

export async function incrementAiReplies(db: Db, ownerId: string, periodStart: string) {
  const [row] = await db
    .insert(usageCounters)
    .values({ ownerId, periodStart, aiReplies: 1 })
    .onConflictDoUpdate({
      target: [usageCounters.ownerId, usageCounters.periodStart],
      set: {
        aiReplies: sql`${usageCounters.aiReplies} + 1`,
        updatedAt: new Date(),
      },
    })
    .returning();

  return row;
}

export async function countAiReplies(db: Db, ownerId: string, periodStart: string) {
  const row = await getUsageForPeriod(db, ownerId, periodStart);

  return row?.aiReplies ?? 0;
}
