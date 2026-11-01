import { desc, eq } from "drizzle-orm";
import type { Db } from "../client.ts";
import type { webhookEventStatusEnum, webhookFieldEnum } from "../schema/enums.ts";
import { webhookEvents } from "../schema/webhooks.ts";

export type WebhookField = (typeof webhookFieldEnum.enumValues)[number];
export type WebhookEventStatus = (typeof webhookEventStatusEnum.enumValues)[number];

export type NewWebhookEvent = {
  fbPageId: string;
  object: string;
  field: WebhookField;
  raw: unknown;
  pageId?: string | null;
};

export async function recordWebhookEvent(db: Db, input: NewWebhookEvent) {
  const [event] = await db
    .insert(webhookEvents)
    .values({
      fbPageId: input.fbPageId,
      object: input.object,
      field: input.field,
      raw: input.raw,
      pageId: input.pageId ?? null,
    })
    .returning();

  return event;
}

export async function markWebhookEvent(
  db: Db,
  input: { id: string; status: WebhookEventStatus; error?: string },
) {
  const [event] = await db
    .update(webhookEvents)
    .set({
      status: input.status,
      error: input.error ?? null,
      processedAt: new Date(),
    })
    .where(eq(webhookEvents.id, input.id))
    .returning();

  return event;
}

export async function listWebhookEventsForPage(db: Db, pageId: string, limit = 50) {
  return db
    .select()
    .from(webhookEvents)
    .where(eq(webhookEvents.pageId, pageId))
    .orderBy(desc(webhookEvents.receivedAt))
    .limit(limit);
}

export async function countWebhookEventsByStatus(db: Db, fbPageId: string) {
  const rows = await db
    .select({ status: webhookEvents.status })
    .from(webhookEvents)
    .where(eq(webhookEvents.fbPageId, fbPageId));

  return rows.reduce<Record<string, number>>((counts, row) => {
    counts[row.status] = (counts[row.status] ?? 0) + 1;
    return counts;
  }, {});
}
