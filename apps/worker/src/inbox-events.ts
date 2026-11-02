import type { Db } from "@fb-bot/db";
import { sql } from "drizzle-orm";
import { logger } from "./logger.ts";

export type InboxEvent = {
  pageId: string;
  kind: "handoff" | "draft" | "sent" | "lead" | "comment";
  conversationId?: string;
  commentId?: string;
  reason?: string | null;
};

/**
 * The inbox listens with LISTEN inbox_events, which keeps the worker free of any
 * knowledge about how the seller's browser is connected.
 */
export async function notifyInbox(db: Db, event: InboxEvent): Promise<void> {
  try {
    await db.execute(sql`select pg_notify('inbox_events', ${JSON.stringify(event)})`);
  } catch (error) {
    logger.warn({ err: error }, "[worker] could not publish an inbox event");
  }
}
